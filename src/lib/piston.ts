import type { PistonExecutionResult, TestCaseResult } from "@/types/database";

export const MAX_SOURCE_CODE_BYTES = 50_000;
export const PISTON_TIMEOUT_MS = 30_000;
export const EVALUATE_PER_TEST_TIMEOUT_MS = 25_000;

const SUPPORTED_LANGUAGES = new Set(["python", "java", "c", "cpp"]);

export function isSupportedLanguage(lang: string): boolean {
  return SUPPORTED_LANGUAGES.has(lang);
}

export function getSourceCodeSizeBytes(code: string): number {
  return new TextEncoder().encode(code).byteLength;
}

export interface PistonError {
  error: string;
  details?: string;
  suggestion?: string;
  error_type?: "compile" | "runtime" | "timeout" | "unavailable" | "malformed" | "unknown";
}

function classifyPistonError(message: string): PistonError["error_type"] {
  const lower = message.toLowerCase();
  if (lower.includes("timed out") || lower.includes("timeout") || lower.includes("abort")) return "timeout";
  if (lower.includes("compile") || lower.includes("syntax")) return "compile";
  if (lower.includes("econnrefused") || lower.includes("fetch") || lower.includes("network") || lower.includes("unavailable")) return "unavailable";
  if (lower.includes("malformed") || lower.includes("json") || lower.includes("parse")) return "malformed";
  return "unknown";
}

export async function executeCode(
  language: string,
  code: string,
  stdin: string = "",
  timeoutMs: number = PISTON_TIMEOUT_MS
): Promise<PistonExecutionResult | PistonError> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch("/api/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language, code, stdin }),
      signal: controller.signal,
    });

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return {
        error: "Execution server returned an invalid response",
        details: `HTTP ${res.status}`,
        suggestion: "The execution server may be overloaded. Try again.",
        error_type: "malformed",
      };
    }

    if (!res.ok) {
      const errData = data as Record<string, unknown>;
      return {
        error: (errData.error as string) || `Request failed with status ${res.status}`,
        details: errData.details as string | undefined,
        suggestion: errData.suggestion as string | undefined,
        error_type: classifyPistonError((errData.error as string) || ""),
      };
    }

    const result = data as PistonExecutionResult;
    if (!result.run || typeof result.run !== "object") {
      return {
        error: "Execution server returned a malformed response",
        details: "Missing 'run' field in Piston response",
        error_type: "malformed",
      };
    }

    return result;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        error: `Execution timed out after ${timeoutMs / 1000} seconds`,
        details: "The execution server did not respond in time.",
        suggestion: "Check the Piston instance and try again.",
        error_type: "timeout",
      };
    }

    const message = err instanceof Error ? err.message : "Network error";
    return {
      error: "Failed to reach code execution server",
      details: message,
      suggestion: "Check your internet connection or try again.",
      error_type: classifyPistonError(message),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Execute code directly against the Piston API with AbortController timeout.
 * Used by server-side evaluate endpoint (bypasses /api/execute proxy).
 */
export async function executeCodeDirect(
  pistonUrl: string,
  language: string,
  code: string,
  stdin: string = "",
  timeoutMs: number = EVALUATE_PER_TEST_TIMEOUT_MS
): Promise<PistonExecutionResult | PistonError> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(`${pistonUrl}/execute`, {
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

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return {
        error: "Piston returned a malformed response",
        details: `HTTP ${res.status}, body is not valid JSON`,
        error_type: "malformed",
      };
    }

    if (!res.ok) {
      const errData = data as Record<string, unknown>;
      const errorMsg = (errData.error as string) || `Piston returned status ${res.status}`;
      return {
        error: errorMsg,
        details: JSON.stringify(errData),
        error_type: classifyPistonError(errorMsg),
      };
    }

    const result = data as PistonExecutionResult;
    if (!result.run || typeof result.run !== "object") {
      return {
        error: "Piston returned a malformed response",
        details: "Missing 'run' field in response",
        error_type: "malformed",
      };
    }

    return result;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        error: `Execution timed out after ${timeoutMs / 1000} seconds`,
        details: "Piston did not respond in time.",
        error_type: "timeout",
      };
    }

    const message = err instanceof Error ? err.message : "Network error";
    return {
      error: "Failed to reach Piston API",
      details: message,
      error_type: classifyPistonError(message),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function normalizeOutput(raw: string): string {
  return raw.replace(/\r\n/g, "\n").trim();
}

export function evaluateTestCase(
  result: PistonExecutionResult | PistonError,
  expectedOutput: string
): TestCaseResult {
  if ("error" in result) {
    return {
      passed: false,
      stdin: "",
      expected: expectedOutput,
      actual: "",
      error: result.error,
    };
  }

  const actual = normalizeOutput(result.run?.stdout ?? "");
  const expected = normalizeOutput(expectedOutput);

  return {
    passed: actual === expected,
    stdin: "",
    expected,
    actual,
    error: result.run?.code !== 0 ? result.run?.stderr || `Exit code: ${result.run.code}` : undefined,
  };
}

export function getLanguagePistonId(language: string): string {
  const map: Record<string, string> = {
    python: "python",
    java: "java",
    c: "c",
    cpp: "cpp",
  };
  return map[language] || language;
}

export function getLanguageMonacoId(language: string): string {
  const map: Record<string, string> = {
    python: "python",
    java: "java",
    c: "c",
    cpp: "cpp",
  };
  return map[language] || "plaintext";
}

export function getLanguageFileExtension(language: string): string {
  const map: Record<string, string> = {
    python: ".py",
    java: ".java",
    c: ".c",
    cpp: ".cpp",
  };
  return map[language] || ".txt";
}
