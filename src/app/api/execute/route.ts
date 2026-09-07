import { getAuthUser } from "@/lib/supabase/server";
import {
  MAX_SOURCE_CODE_BYTES,
  PISTON_TIMEOUT_MS,
  getSourceCodeSizeBytes,
  isSupportedLanguage,
} from "@/lib/piston";
import { NextResponse } from "next/server";

const PISTON_URL = process.env.NEXT_PUBLIC_PISTON_URL || "https://emkc.org/api/v2/piston";
const MAX_REQUEST_BODY_BYTES = 100_000;

export async function POST(request: Request) {
  try {
    const auth = await getAuthUser();
    if (!auth.ok) return auth.response;

    const contentLength = request.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_BODY_BYTES) {
      return NextResponse.json(
        { error: "Request body too large", error_type: "unknown" },
        { status: 413 }
      );
    }

    let body: { language?: string; code?: string; stdin?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body", error_type: "malformed" },
        { status: 400 }
      );
    }

    const { language, code, stdin = "" } = body;

    if (!language || !code) {
      return NextResponse.json(
        { error: "Language and code are required", error_type: "unknown" },
        { status: 400 }
      );
    }

    if (!isSupportedLanguage(language)) {
      return NextResponse.json(
        {
          error: `Unsupported language: ${language}. Supported: python, java, c, cpp`,
          error_type: "unknown",
        },
        { status: 400 }
      );
    }

    const codeSizeBytes = getSourceCodeSizeBytes(code);
    if (codeSizeBytes > MAX_SOURCE_CODE_BYTES) {
      return NextResponse.json(
        {
          error: `Source code too large (${codeSizeBytes} bytes, max ${MAX_SOURCE_CODE_BYTES})`,
          error_type: "unknown",
        },
        { status: 413 }
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), PISTON_TIMEOUT_MS);

    let pistonResponse: Response;
    try {
      pistonResponse = await fetch(`${PISTON_URL}/execute`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language,
          version: "*",
          files: [{ content: code }],
          stdin,
        }),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timeout);
      const message = err instanceof Error ? err.message : "Network error";
      const isTimeout = err instanceof Error && err.name === "AbortError";

      return NextResponse.json(
        {
          error: isTimeout
            ? `Piston API timed out after ${PISTON_TIMEOUT_MS / 1000}s`
            : "Cannot reach Piston API",
          details: message,
          error_type: isTimeout ? "timeout" : "unavailable",
          suggestion: isTimeout
            ? "The Piston instance is overloaded or unreachable."
            : "Set NEXT_PUBLIC_PISTON_URL to your self-hosted Piston instance.",
        },
        { status: 502 }
      );
    } finally {
      clearTimeout(timeout);
    }

    if (!pistonResponse.ok) {
      let errorText: string;
      try {
        errorText = await pistonResponse.text();
      } catch {
        errorText = "Could not read error response";
      }

      if (pistonResponse.status === 403 || pistonResponse.status === 401) {
        return NextResponse.json(
          {
            error: "Piston API authorization failed",
            details: errorText,
            error_type: "unavailable",
            suggestion: "Set NEXT_PUBLIC_PISTON_URL to your self-hosted Piston instance.",
          },
          { status: 502 }
        );
      }

      if (pistonResponse.status === 429) {
        return NextResponse.json(
          {
            error: "Rate limited by Piston API",
            details: errorText,
            error_type: "unavailable",
          },
          { status: 429 }
        );
      }

      return NextResponse.json(
        {
          error: `Piston API returned status ${pistonResponse.status}`,
          details: errorText,
          error_type: "unavailable",
        },
        { status: 502 }
      );
    }

    let data: unknown;
    try {
      data = await pistonResponse.json();
    } catch {
      return NextResponse.json(
        {
          error: "Piston returned a malformed response (not valid JSON)",
          error_type: "malformed",
        },
        { status: 502 }
      );
    }

    if (!data || typeof data !== "object" || !("run" in data) || !(data as Record<string, unknown>).run) {
      return NextResponse.json(
        {
          error: "Piston returned a response without 'run' field",
          error_type: "malformed",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "Internal server error during code execution", error_type: "unknown" },
      { status: 500 }
    );
  }
}
