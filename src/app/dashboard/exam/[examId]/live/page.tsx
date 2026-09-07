"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useAntiCheat } from "@/hooks/useAntiCheat";
import { executeCode, normalizeOutput, getSourceCodeSizeBytes, MAX_SOURCE_CODE_BYTES } from "@/lib/piston";
import type { Settings } from "@/types/database";
import CodeEditor from "@/components/exam/CodeEditor";
import ProblemPanel from "@/components/exam/ProblemPanel";
import TestResults from "@/components/exam/TestResults";
import Timer from "@/components/exam/Timer";
import ViolationModal from "@/components/exam/ViolationModal";
import {
  Play,
  Send,
  Maximize2,
  Minimize2,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

interface Question {
  id: string;
  exam_number: number;
  title: string;
  description: string;
  starter_code: string | null;
  language: string;
  difficulty: string;
  question_type: string;
  test_cases?: Array<{
    id: string;
    is_sample: boolean;
    stdin: string;
    expected_stdout: string;
    description: string | null;
    sort_order: number;
  }>;
}

export default function LiveExamPage() {
  const params = useParams();
  const router = useRouter();
  const examId = Number(params.examId);
  const { user, profile } = useAuth();

  const [settings, setSettings] = useState<Settings | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [code, setCode] = useState("");
  const [testResults, setTestResults] = useState<
    Array<{
      passed: boolean;
      stdin: string;
      expected: string;
      actual: string;
      error?: string;
    }>
  >([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<string>("");
  const [durationMinutes, setDurationMinutes] = useState<number>(30);
  const [error, setError] = useState("");
  const [submitResult, setSubmitResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const [questionType, setQuestionType] = useState<string>("");
  const [submitted, setSubmitted] = useState(false);
  const [postSubmitResults, setPostSubmitResults] = useState<
    Array<{
      questionId: string;
      title: string;
      sampleResults: Array<{
        passed: boolean;
        stdin: string;
        expected: string;
        actual: string;
        error?: string;
      }>;
      hiddenTestsPassed: number;
      hiddenTestsTotal: number;
    }>
  >([]);
  const codeRef = useRef(code);
  useEffect(() => {
    codeRef.current = code;
  }, [code]);

  // Once-guard: auto-submit must fire exactly once per session, no matter how
  // many triggers race (timer expiry, anti-cheat background limit, manual).
  const autoSubmittedRef = useRef(false);

  // Fetch settings
  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then(setSettings)
      .catch(console.error);
  }, []);

  // Fetch questions
  useEffect(() => {
    if (!examId) return;
    fetch(`/api/questions?exam=${examId}`)
      .then((r) => {
        if (r.status === 403) {
          return r.json().then((data) => {
            setError(data.error || "Exam not yet unlocked");
            return [];
          });
        }
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setQuestions(data);
          setCode(data[0].starter_code || "");
          setQuestionType(data[0].question_type || (examId === 1 ? "TDD" : "DEBUGGING"));
        }
      })
      .catch(console.error);
  }, [examId]);

  // Auto-submit function — triggered by timer expiry, anti-cheat background
  // limit, or manual submit. Sends code to the server for grading; the server
  // evaluates all test cases (sample + hidden) and records the submission.
  // The session is always force-completed in `finally` to prevent re-entry.
  const autoSubmit = useCallback(
    async (reason?: string) => {
      if (!user || !sessionId || autoSubmittedRef.current) return;
      autoSubmittedRef.current = true;
      setIsSubmitting(true);

      console.error("[auto-submit] triggered", {
        reason: reason ?? "manual",
        examId,
        sessionId,
        questionCount: questions.length,
        timestamp: new Date().toISOString(),
      });

      let evaluationHadErrors = false;
      let submissionSaveFailed = false;
      let alreadySubmitted = false;
      const results: typeof postSubmitResults = [];

      try {
        for (let i = 0; i < questions.length; i++) {
          const q = questions[i];
          const codeToSubmit =
            i === currentQuestionIndex ? codeRef.current : q.starter_code || "";

          try {
            const res = await fetch("/api/submissions/evaluate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                question_id: q.id,
                code: codeToSubmit,
                exam_session_id: sessionId,
              }),
            });

            // 409 = session already submitted (concurrent auto-submit won)
            if (res.status === 409) {
              alreadySubmitted = true;
              break;
            }

            if (!res.ok) {
              submissionSaveFailed = true;
              console.error(
                "[auto-submit] evaluate failed",
                {
                  questionId: q.id,
                  status: res.status,
                  body: await res.text().catch(() => ""),
                }
              );
              results.push({
                questionId: q.id,
                title: q.title,
                sampleResults: [],
                hiddenTestsPassed: 0,
                hiddenTestsTotal: 0,
              });
            } else {
              const data = await res.json();
              results.push({
                questionId: q.id,
                title: q.title,
                sampleResults: data.sample_results || [],
                hiddenTestsPassed: data.hidden_tests_passed || 0,
                hiddenTestsTotal: data.hidden_tests_total || 0,
              });
            }
          } catch (err) {
            evaluationHadErrors = true;
            console.error(
              "[auto-submit] network error calling evaluate",
              { questionId: q.id, err }
            );
            results.push({
              questionId: q.id,
              title: q.title,
              sampleResults: [],
              hiddenTestsPassed: 0,
              hiddenTestsTotal: 0,
            });
          }
        }
      } catch (err) {
        evaluationHadErrors = true;
        console.error(
          "[auto-submit] unexpected error during evaluation loop",
          err
        );
      } finally {
        // Skip session PATCH if another request already completed it
        if (!alreadySubmitted) {
          // Force-complete the session even if evaluation failed, to prevent re-entry
          const completeSession = async () => {
            const res = await fetch("/api/exam-sessions", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: sessionId,
                status: "completed",
                is_submitted: true,
                submitted_at: new Date().toISOString(),
              }),
            });
            if (!res.ok) {
              throw new Error(`status ${res.status}: ${await res.text().catch(() => "")}`);
            }
          };

          try {
            await completeSession();
          } catch (err) {
            console.error(
              "[auto-submit] failed to mark session completed — retrying once",
              err
            );
            try {
              await completeSession();
            } catch (retryErr) {
              console.error(
                "[auto-submit] retry also failed — manual intervention required",
                retryErr
              );
            }
          }
        }

        if (document.fullscreenElement) {
          await document.exitFullscreen().catch(() => {});
        }

        setPostSubmitResults(results);
        setSubmitted(true);
        setSubmitResult({
          success: true,
          message: alreadySubmitted
            ? "Exam was already submitted."
            : reason === "background_limit"
            ? "Exam auto-submitted (background time limit exceeded)."
            : reason === "timer_expired"
            ? "Exam auto-submitted (time expired)."
            : evaluationHadErrors || submissionSaveFailed
            ? "Exam submitted, but some results could not be saved. Please contact the admin."
            : "Exam submitted successfully!",
        });
        setIsSubmitting(false);
      }
    },
    [user, sessionId, questions, currentQuestionIndex, examId]
  );

  // Manual submit
  const handleSubmit = async () => {
    setShowSubmitConfirm(false);
    await autoSubmit();
  };

  // Anti-cheat
  const handleViolation = useCallback(
    async (type: string, description: string) => {
      if (!sessionId || !user) return;
      try {
        const res = await fetch("/api/violations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: user.id,
            exam_session_id: sessionId,
            violation_type: type,
            description,
          }),
        });
        if (!res.ok) {
          console.error(
            "[violation] failed to record",
            { type, status: res.status, body: await res.text().catch(() => "") }
          );
        }
      } catch (err) {
        console.error("[violation] network error recording violation", err);
      }
    },
    [sessionId, user]
  );

  const {
    showWarning,
    warningMessage,
    violationType,
    remainingCount,
    dismissWarning,
    requestFullscreen,
  } = useAntiCheat({
    isEnabled: settings?.is_anti_cheat_enabled ?? true,
    examSessionId: sessionId || "",
    onViolation: handleViolation,
    onAutoSubmit: autoSubmit,
  });

  // Fullscreen toggle
  const toggleFullscreen = async () => {
    if (!document.fullscreenElement) {
      await requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Start exam session (or resume if in_progress)
  const startExam = async () => {
    if (!user) return;

    try {
      const res = await fetch("/api/exam-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exam_number: examId,
        }),
      });
      const data = await res.json();

      // Server rejects if round not yet unlocked
      if (res.status === 403) {
        setSubmitResult({
          success: false,
          message: data.error || "Exam not yet unlocked",
        });
        setSessionStarted(true);
        return;
      }

      // If already completed, show completion screen
      if (data.status === "completed") {
        setSubmitResult({
          success: true,
          message: "You have already submitted this exam.",
        });
        setSessionStarted(true);
        return;
      }

      setSessionId(data.id);
      setStartedAt(data.started_at);
      // Use server-authoritative duration snapshot — ignores future admin changes
      setDurationMinutes(data.duration_minutes || 30);
      setSessionStarted(true);

      // Enter fullscreen
      await requestFullscreen();
      setIsFullscreen(true);
    } catch (err) {
      setError("Failed to start exam session");
    }
  };

  // Run sample tests
  const handleRunCode = async () => {
    if (!questions[currentQuestionIndex] || isRunning) return;

    const codeSize = getSourceCodeSizeBytes(code);
    if (codeSize > MAX_SOURCE_CODE_BYTES) {
      setTestResults([
        {
          passed: false,
          stdin: "",
          expected: "",
          actual: "",
          error: `Source code too large (${codeSize} bytes, max ${MAX_SOURCE_CODE_BYTES})`,
        },
      ]);
      return;
    }

    setIsRunning(true);
    setTestResults([]);

    const question = questions[currentQuestionIndex];
    const sampleTests = (question.test_cases || []).filter((tc) => tc.is_sample);

    if (sampleTests.length === 0) {
      setTestResults([
        {
          passed: false,
          stdin: "",
          expected: "",
          actual: "",
          error: "No sample test cases available for this problem.",
        },
      ]);
      setIsRunning(false);
      return;
    }

    const results = [];
    for (const tc of sampleTests) {
      const result = await executeCode(question.language, code, tc.stdin);
      const actual =
        "error" in result ? "" : normalizeOutput(result.run.stdout);
      const expected = normalizeOutput(tc.expected_stdout);
      results.push({
        passed: actual === expected,
        stdin: tc.stdin,
        expected,
        actual,
        error: "error" in result
          ? result.error
          : result.run.code !== 0
          ? result.run.stderr || `Exit code: ${result.run.code}`
          : undefined,
      });
    }

    setTestResults(results);
    setIsRunning(false);
  };

  // Submit results display
  if (submitResult) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-surface border border-border rounded-2xl p-8 max-w-md text-center">
          {submitResult.success ? (
            <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
          ) : (
            <XCircle className="w-16 h-16 text-danger mx-auto mb-4" />
          )}
          <h2 className="text-2xl font-bold text-foreground mb-2">
            {submitResult.success ? "Exam Submitted!" : "Submission Error"}
          </h2>
          <p className="text-gray-400 mb-6">{submitResult.message}</p>
          <button
            onClick={() => router.push("/dashboard")}
            className="px-6 py-2 bg-primary hover:bg-primary-light text-white rounded-lg font-medium transition-colors"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Not started yet - show start screen
  if (!sessionStarted) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="bg-surface border border-border rounded-2xl p-8 max-w-md text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Round {examId}: {examId === 1 ? "Test-Driven Development" : "Code Debugging"}
          </h2>
          <p className="text-gray-400 mb-2">
            {questions.length} question{questions.length !== 1 ? "s" : ""} •{" "}
            {settings?.[`exam${examId}_duration_minutes` as keyof Settings] || 30} minutes
          </p>
          {settings?.is_anti_cheat_enabled && (
            <p className="text-warning text-sm mb-4">
              Anti-cheat is enabled. Fullscreen is mandatory.
            </p>
          )}
          {error && (
            <p className="text-danger text-sm mb-4">{error}</p>
          )}
          <button
            onClick={startExam}
            disabled={questions.length === 0}
            className="px-8 py-3 bg-primary hover:bg-primary-light disabled:opacity-50 text-white rounded-xl font-semibold text-lg transition-colors"
          >
            {questions.length === 0 ? (
              <Loader2 className="animate-spin inline" />
            ) : (
              "Start Exam"
            )}
          </button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
    <div className="h-screen flex flex-col bg-background overflow-hidden">
      <ViolationModal
        show={showWarning}
        message={warningMessage}
        violationType={violationType}
        remainingCount={remainingCount}
        onDismiss={dismissWarning}
      />

      {/* Top bar */}
      <div className="h-14 border-b border-border bg-surface/50 backdrop-blur-sm flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-foreground">
            Round {examId}: {examId === 1 ? "TDD" : "Debugging"}
          </span>
          <span className="text-xs text-gray-400">
            Q{currentQuestionIndex + 1}/{questions.length}
          </span>
        </div>

        <Timer
          durationMinutes={durationMinutes}
          startedAt={startedAt}
          onTimeUp={() => autoSubmit("timer_expired")}
          isActive={sessionStarted}
        />

        <div className="flex items-center gap-2">
          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-400 hover:text-foreground hover:bg-surface-light rounded-lg transition-colors"
          >
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={isSubmitting || submitted}
            className="px-4 py-1.5 bg-success hover:bg-success/80 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <Send size={14} />
            Submit
          </button>
        </div>
      </div>

      {/* Question tabs */}
      {questions.length > 1 && (
        <div className="border-b border-border bg-surface/30 flex shrink-0 overflow-x-auto">
          {questions.map((q, i) => (
            <button
              key={q.id}
              onClick={() => {
                setCurrentQuestionIndex(i);
                setQuestionType(q.question_type || (examId === 1 ? "TDD" : "DEBUGGING"));
                setCode(q.starter_code || "");
                setTestResults([]);
              }}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                i === currentQuestionIndex
                  ? "border-primary-light text-primary-light"
                  : "border-transparent text-gray-400 hover:text-foreground"
              }`}
            >
              Q{i + 1}: {q.title}
            </button>
          ))}
        </div>
      )}

      {/* Main split pane */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Problem statement */}
        <div className="w-1/2 border-r border-border overflow-hidden">
          {currentQuestion && (
            <ProblemPanel
              title={currentQuestion.title}
              description={currentQuestion.description}
              language={currentQuestion.language}
              difficulty={currentQuestion.difficulty}
              questionType={questionType}
            />
          )}
        </div>

        {/* Right: Code editor + results */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          {/* Language selector + Run button */}
          <div className="h-10 border-b border-border bg-surface/30 flex items-center justify-between px-4 shrink-0">
            <span className="text-xs text-gray-400">
              {currentQuestion?.language || "python"}
            </span>
            <button
              onClick={handleRunCode}
              disabled={isRunning || submitted}
              className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary-light rounded text-xs font-medium transition-colors disabled:opacity-50"
            >
              {isRunning ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Play size={12} />
              )}
              Run Code
            </button>
          </div>

          {/* Monaco editor */}
          <div className="flex-1 min-h-0">
            <CodeEditor
              code={code}
              language={currentQuestion?.language || "python"}
              onChange={setCode}
            />
          </div>

          {/* Test results / Post-submission summary */}
          <div className="shrink-0">
            {submitted ? (
              <div className="border-t border-border bg-surface">
                <div className="px-4 py-3 border-b border-border">
                  <span className="text-sm font-medium text-foreground">
                    Submission Results
                  </span>
                </div>
                <div className="max-h-48 overflow-y-auto">
                  {postSubmitResults.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                      Results pending...
                    </div>
                  ) : (
                    postSubmitResults.map((qr) => (
                      <div
                        key={qr.questionId}
                        className="px-4 py-2.5 border-b border-border last:border-0"
                      >
                        <div className="text-xs font-medium text-foreground mb-1">
                          {qr.title}
                        </div>
                        <div className="flex gap-4 text-xs text-gray-400">
                          <span>
                            Sample:{" "}
                            <span
                              className={
                                qr.sampleResults.length > 0 &&
                                qr.sampleResults.every((r) => r.passed)
                                  ? "text-success"
                                  : "text-warning"
                              }
                            >
                              {qr.sampleResults.filter((r) => r.passed).length}/
                              {qr.sampleResults.length} passed
                            </span>
                          </span>
                          <span>
                            Hidden:{" "}
                            <span
                              className={
                                qr.hiddenTestsTotal > 0 &&
                                qr.hiddenTestsPassed === qr.hiddenTestsTotal
                                  ? "text-success"
                                  : "text-warning"
                              }
                            >
                              {qr.hiddenTestsPassed}/{qr.hiddenTestsTotal} passed
                            </span>
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ) : (
              <TestResults
                results={testResults}
                isRunning={isRunning}
                showHidden={false}
              />
            )}
          </div>
        </div>
      </div>

      {/* Submit confirmation modal */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="bg-surface border border-border rounded-2xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-bold text-foreground mb-2">
              Submit Exam?
            </h3>
            <p className="text-gray-400 mb-6">
              Are you sure you want to submit? You won&apos;t be able to make
              changes after submission.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="px-4 py-2 bg-surface-light border border-border rounded-lg text-foreground hover:bg-border transition-colors text-sm font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 bg-success hover:bg-success/80 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
              >
                {isSubmitting ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Send size={14} />
                )}
                Confirm Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
