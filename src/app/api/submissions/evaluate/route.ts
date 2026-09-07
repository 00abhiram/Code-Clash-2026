import { getAuthUser, getSettings, isSessionExpired, createServiceRoleClient } from "@/lib/supabase/server";
import {
  MAX_SOURCE_CODE_BYTES,
  getSourceCodeSizeBytes,
  executeCodeDirect,
  normalizeOutput,
} from "@/lib/piston";
import { NextResponse } from "next/server";

const PISTON_URL =
  process.env.NEXT_PUBLIC_PISTON_URL || "https://emkc.org/api/v2/piston";

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;

    const { user, supabase } = auth;
    const { question_id, code, exam_session_id } = await request.json();

    if (!question_id || !code || !exam_session_id) {
      return NextResponse.json(
        { error: "question_id, code, and exam_session_id are required" },
        { status: 400 }
      );
    }

    if (typeof code !== "string" || code.length === 0) {
      return NextResponse.json(
        { error: "code must be a non-empty string" },
        { status: 400 }
      );
    }

    const codeSizeBytes = getSourceCodeSizeBytes(code);
    if (codeSizeBytes > MAX_SOURCE_CODE_BYTES) {
      return NextResponse.json(
        {
          error: `Source code too large (${codeSizeBytes} bytes, max ${MAX_SOURCE_CODE_BYTES})`,
        },
        { status: 413 }
      );
    }

    const { data: session, error: sError } = await supabase
      .from("exam_sessions")
      .select("id, user_id, status, exam_number, started_at, duration_minutes")
      .eq("id", exam_session_id)
      .single();

    if (sError || !session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    if (session.user_id !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    if (session.status === "completed") {
      return NextResponse.json(
        { error: "Session already submitted" },
        { status: 409 }
      );
    }

    const settings = await getSettings(supabase);
    if (isSessionExpired(session, settings, session.exam_number)) {
      return NextResponse.json(
        { error: "Session expired" },
        { status: 400 }
      );
    }

    const { data: existingSub } = await supabase
      .from("submissions")
      .select("id, sample_tests_passed, sample_tests_total, hidden_tests_passed, hidden_tests_total, execution_time_ms, status")
      .eq("question_id", question_id)
      .eq("exam_session_id", exam_session_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingSub?.id) {
      const { data: sampleCases } = await supabase
        .from("test_cases")
        .select("id, stdin, expected_stdout, description, sort_order")
        .eq("question_id", question_id)
        .eq("is_sample", true)
        .order("sort_order");

      return NextResponse.json({
        submission: existingSub,
        sample_results: (sampleCases || []).map((tc) => ({
          passed: true,
          stdin: tc.stdin,
          expected: tc.expected_stdout,
          actual: "",
          error: undefined,
        })),
        hidden_tests_passed: existingSub.hidden_tests_passed,
        hidden_tests_total: existingSub.hidden_tests_total,
        idempotent: true,
      });
    }

    const { data: question, error: qError } = await supabase
      .from("questions")
      .select("language, is_active")
      .eq("id", question_id)
      .single();

    if (qError || !question?.is_active) {
      return NextResponse.json(
        { error: "Question not found or inactive" },
        { status: 404 }
      );
    }

    // Use service-role client for get_all_test_cases (restricted to service_role only)
    const serviceClient = createServiceRoleClient();
    const { data: testCases, error: tcError } = await serviceClient
      .rpc("get_all_test_cases", { p_question_id: question_id });

    if (tcError) {
      return NextResponse.json(
        { error: `Failed to load test cases: ${tcError.message}` },
        { status: 500 }
      );
    }

    const allTestCases = testCases || [];
    if (allTestCases.length === 0) {
      return NextResponse.json(
        { error: "No test cases found for this question" },
        { status: 500 }
      );
    }

    const sampleResults: Array<{
      passed: boolean;
      stdin: string;
      expected: string;
      actual: string;
      error?: string;
    }> = [];
    let hiddenPassed = 0;
    let hiddenTotal = 0;
    let totalTimeMs = 0;
    let pistonUnavailable = false;

    for (const tc of allTestCases) {
      if (pistonUnavailable) {
        if (tc.is_sample) {
          sampleResults.push({
            passed: false,
            stdin: tc.stdin,
            expected: normalizeOutput(tc.expected_stdout),
            actual: "",
            error: "Piston unavailable — skipping remaining tests",
          });
        } else {
          hiddenTotal++;
        }
        continue;
      }

      const result = await executeCodeDirect(
        PISTON_URL,
        question.language,
        code,
        tc.stdin
      );

      if ("error" in result) {
        if (result.error_type === "unavailable") {
          pistonUnavailable = true;
        }

        if (tc.is_sample) {
          sampleResults.push({
            passed: false,
            stdin: tc.stdin,
            expected: normalizeOutput(tc.expected_stdout),
            actual: "",
            error: result.error,
          });
        } else {
          hiddenTotal++;
        }
        continue;
      }

      const actual = normalizeOutput(result.run?.stdout ?? "");
      const expected = normalizeOutput(tc.expected_stdout);
      const passed = actual === expected;
      const wallMs = result.run?.wall_time
        ? Number(result.run.wall_time)
        : 0;
      totalTimeMs += wallMs;

      if (tc.is_sample) {
        sampleResults.push({
          passed,
          stdin: tc.stdin,
          expected,
          actual,
          error:
            result.run?.code !== 0
              ? result.run?.stderr || `Exit code: ${result.run.code}`
              : undefined,
        });
      } else {
        hiddenTotal++;
        if (passed) hiddenPassed++;
      }
    }

    const allPassed =
      hiddenTotal > 0
        ? hiddenPassed === hiddenTotal &&
          sampleResults.every((r) => r.passed)
        : sampleResults.every((r) => r.passed);

    const { data: saved, error: saveError } = await supabase
      .rpc("insert_submission", {
        p_user_id: user.id,
        p_question_id: question_id,
        p_exam_session_id: exam_session_id,
        p_code: code,
        p_language: question.language,
        p_sample_tests_passed: sampleResults.filter((r) => r.passed).length,
        p_sample_tests_total: sampleResults.length,
        p_hidden_tests_passed: hiddenPassed,
        p_hidden_tests_total: hiddenTotal,
        p_execution_time_ms: totalTimeMs,
        p_status: allPassed ? "passed" : "failed",
      })
      .single();

    if (saveError) {
      return NextResponse.json({ error: saveError.message }, { status: 500 });
    }

    return NextResponse.json({
      submission: saved,
      sample_results: sampleResults,
      hidden_tests_passed: hiddenPassed,
      hidden_tests_total: hiddenTotal,
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
