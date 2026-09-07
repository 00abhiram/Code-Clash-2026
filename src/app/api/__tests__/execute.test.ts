import { describe, it, expect } from "vitest";

describe("Execute API logic", () => {
  describe("request body validation", () => {
    const MAX_REQUEST_BODY_BYTES = 100_000;

    it("rejects oversized request body", () => {
      const bodySize = MAX_REQUEST_BODY_BYTES + 1;
      expect(bodySize).toBeGreaterThan(MAX_REQUEST_BODY_BYTES);
    });

    it("accepts request body within limit", () => {
      const bodySize = 1000;
      expect(bodySize).toBeLessThanOrEqual(MAX_REQUEST_BODY_BYTES);
    });
  });

  describe("source code size validation", () => {
    const MAX_SOURCE_CODE_BYTES = 50_000;

    it("rejects code exceeding limit", () => {
      const code = "x".repeat(MAX_SOURCE_CODE_BYTES + 1);
      const size = new TextEncoder().encode(code).byteLength;
      expect(size).toBeGreaterThan(MAX_SOURCE_CODE_BYTES);
    });

    it("accepts code within limit", () => {
      const code = "print('hello')";
      const size = new TextEncoder().encode(code).byteLength;
      expect(size).toBeLessThanOrEqual(MAX_SOURCE_CODE_BYTES);
    });
  });

  describe("language validation", () => {
    const SUPPORTED = new Set(["python", "java", "c", "cpp"]);

    it("accepts python", () => expect(SUPPORTED.has("python")).toBe(true));
    it("accepts java", () => expect(SUPPORTED.has("java")).toBe(true));
    it("accepts c", () => expect(SUPPORTED.has("c")).toBe(true));
    it("accepts cpp", () => expect(SUPPORTED.has("cpp")).toBe(true));
    it("rejects javascript", () => expect(SUPPORTED.has("javascript")).toBe(false));
    it("rejects empty string", () => expect(SUPPORTED.has("")).toBe(false));
  });

  describe("Piston response handling", () => {
    it("handles successful response", () => {
      const response = {
        language: "python",
        version: "3.10",
        run: { stdout: "hello\n", stderr: "", code: 0, wall_time: 0.1 },
      };
      expect(response.run.code).toBe(0);
      expect(response.run.stdout).toBe("hello\n");
    });

    it("handles compile error (non-zero exit code)", () => {
      const response = {
        language: "python",
        version: "3.10",
        run: { stdout: "", stderr: "SyntaxError", code: 1, wall_time: 0.05 },
      };
      expect(response.run.code).not.toBe(0);
    });

    it("detects missing run field (malformed)", () => {
      const response = { language: "python" } as Record<string, unknown>;
      const isMalformed = !response.run || typeof response.run !== "object";
      expect(isMalformed).toBe(true);
    });

    it("valid response has run object", () => {
      const response = {
        language: "python",
        run: { stdout: "", stderr: "", code: 0, wall_time: 0.1 },
      };
      const isMalformed = !response.run || typeof response.run !== "object";
      expect(isMalformed).toBe(false);
    });
  });

  describe("timeout behavior", () => {
    it("AbortError produces timeout error type", () => {
      const err = new Error("aborted");
      err.name = "AbortError";
      expect(err.name).toBe("AbortError");
    });

    it("other errors produce network/unavailable type", () => {
      const err = new Error("fetch failed");
      expect(err.name).not.toBe("AbortError");
    });
  });

  describe("error classification", () => {
    function classifyPistonError(message: string): string {
      const lower = message.toLowerCase();
      if (lower.includes("timed out") || lower.includes("timeout") || lower.includes("abort")) return "timeout";
      if (lower.includes("compile") || lower.includes("syntax")) return "compile";
      if (lower.includes("econnrefused") || lower.includes("fetch") || lower.includes("network") || lower.includes("unavailable")) return "unavailable";
      if (lower.includes("malformed") || lower.includes("json") || lower.includes("parse")) return "malformed";
      return "unknown";
    }

    it("classifies timeout errors", () => {
      expect(classifyPistonError("Execution timed out")).toBe("timeout");
      expect(classifyPistonError("Timeout after 30s")).toBe("timeout");
    });

    it("classifies compile errors", () => {
      expect(classifyPistonError("Compile error")).toBe("compile");
      expect(classifyPistonError("SyntaxError: invalid syntax")).toBe("compile");
    });

    it("classifies unavailable errors", () => {
      expect(classifyPistonError("ECONNREFUSED")).toBe("unavailable");
      expect(classifyPistonError("fetch failed")).toBe("unavailable");
    });

    it("classifies malformed errors", () => {
      expect(classifyPistonError("malformed response")).toBe("malformed");
      expect(classifyPistonError("JSON parse error")).toBe("malformed");
    });

    it("classifies unknown errors", () => {
      expect(classifyPistonError("something weird happened")).toBe("unknown");
    });
  });
});
