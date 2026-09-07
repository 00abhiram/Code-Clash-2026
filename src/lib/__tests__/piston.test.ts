import { describe, it, expect } from "vitest";
import {
  isSupportedLanguage,
  getSourceCodeSizeBytes,
  normalizeOutput,
  evaluateTestCase,
  getLanguagePistonId,
  getLanguageMonacoId,
  getLanguageFileExtension,
  MAX_SOURCE_CODE_BYTES,
  PISTON_TIMEOUT_MS,
  EVALUATE_PER_TEST_TIMEOUT_MS,
} from "@/lib/piston";
import type { PistonExecutionResult } from "@/types/database";

describe("piston helpers", () => {
  describe("isSupportedLanguage", () => {
    it.each(["python", "java", "c", "cpp"])(
      "accepts supported language: %s",
      (lang) => {
        expect(isSupportedLanguage(lang)).toBe(true);
      }
    );

    it.each(["javascript", "ruby", "go", "rust", "typescript", ""])(
      "rejects unsupported language: %s",
      (lang) => {
        expect(isSupportedLanguage(lang)).toBe(false);
      }
    );
  });

  describe("getSourceCodeSizeBytes", () => {
    it("returns 0 for empty string", () => {
      expect(getSourceCodeSizeBytes("")).toBe(0);
    });

    it("returns correct byte count for ASCII", () => {
      expect(getSourceCodeSizeBytes("hello")).toBe(5);
    });

    it("returns correct byte count for multi-byte UTF-8", () => {
      // "hello" is 5 bytes, "é" is 2 bytes → total 7
      expect(getSourceCodeSizeBytes("helloé")).toBe(7);
    });

    it("rejects code exceeding MAX_SOURCE_CODE_BYTES", () => {
      const hugeCode = "x".repeat(MAX_SOURCE_CODE_BYTES + 1);
      expect(getSourceCodeSizeBytes(hugeCode)).toBeGreaterThan(MAX_SOURCE_CODE_BYTES);
    });

    it("accepts code at exactly MAX_SOURCE_CODE_BYTES", () => {
      const exactCode = "x".repeat(MAX_SOURCE_CODE_BYTES);
      expect(getSourceCodeSizeBytes(exactCode)).toBe(MAX_SOURCE_CODE_BYTES);
    });
  });

  describe("normalizeOutput", () => {
    it("trims whitespace", () => {
      expect(normalizeOutput("  hello  ")).toBe("hello");
    });

    it("converts CRLF to LF", () => {
      expect(normalizeOutput("hello\r\nworld")).toBe("hello\nworld");
    });

    it("preserves single newlines", () => {
      expect(normalizeOutput("hello\nworld")).toBe("hello\nworld");
    });

    it("handles empty string", () => {
      expect(normalizeOutput("")).toBe("");
    });

    it("handles only whitespace", () => {
      expect(normalizeOutput("   ")).toBe("");
    });
  });

  describe("evaluateTestCase", () => {
    it("passes when output matches expected", () => {
      const result: PistonExecutionResult = {
        language: "python",
        version: "3.10",
        run: { stdout: "hello\n", stderr: "", output: "", code: 0, signal: null, message: null, status: null, cpu_time: null, wall_time: 100, memory: null },
      };
      const tc = evaluateTestCase(result, "hello\n");
      expect(tc.passed).toBe(true);
      expect(tc.actual).toBe("hello");
      expect(tc.expected).toBe("hello");
    });

    it("fails when output does not match expected", () => {
      const result: PistonExecutionResult = {
        language: "python",
        version: "3.10",
        run: { stdout: "world\n", stderr: "", output: "", code: 0, signal: null, message: null, status: null, cpu_time: null, wall_time: 100, memory: null },
      };
      const tc = evaluateTestCase(result, "hello\n");
      expect(tc.passed).toBe(false);
    });

    it("reports error for PistonError", () => {
      const error = { error: "Piston unavailable", error_type: "unavailable" as const };
      const tc = evaluateTestCase(error, "hello");
      expect(tc.passed).toBe(false);
      expect(tc.error).toBe("Piston unavailable");
    });

    it("includes stderr when exit code is non-zero", () => {
      const result: PistonExecutionResult = {
        language: "python",
        version: "3.10",
        run: { stdout: "", stderr: "Traceback error", output: "", code: 1, signal: null, message: null, status: null, cpu_time: null, wall_time: 100, memory: null },
      };
      const tc = evaluateTestCase(result, "hello");
      expect(tc.passed).toBe(false);
      expect(tc.error).toBe("Traceback error");
    });
  });

  describe("getLanguagePistonId", () => {
    it("returns correct Piston IDs", () => {
      expect(getLanguagePistonId("python")).toBe("python");
      expect(getLanguagePistonId("java")).toBe("java");
      expect(getLanguagePistonId("c")).toBe("c");
      expect(getLanguagePistonId("cpp")).toBe("cpp");
    });

    it("falls back to input for unknown languages", () => {
      expect(getLanguagePistonId("rust")).toBe("rust");
    });
  });

  describe("getLanguageMonacoId", () => {
    it("returns correct Monaco IDs", () => {
      expect(getLanguageMonacoId("python")).toBe("python");
      expect(getLanguageMonacoId("java")).toBe("java");
    });

    it("returns plaintext for unknown languages", () => {
      expect(getLanguageMonacoId("unknown")).toBe("plaintext");
    });
  });

  describe("getLanguageFileExtension", () => {
    it("returns correct extensions", () => {
      expect(getLanguageFileExtension("python")).toBe(".py");
      expect(getLanguageFileExtension("java")).toBe(".java");
      expect(getLanguageFileExtension("c")).toBe(".c");
      expect(getLanguageFileExtension("cpp")).toBe(".cpp");
    });

    it("returns .txt for unknown languages", () => {
      expect(getLanguageFileExtension("unknown")).toBe(".txt");
    });
  });

  describe("constants", () => {
    it("MAX_SOURCE_CODE_BYTES is 50KB", () => {
      expect(MAX_SOURCE_CODE_BYTES).toBe(50_000);
    });

    it("PISTON_TIMEOUT_MS is 30s", () => {
      expect(PISTON_TIMEOUT_MS).toBe(30_000);
    });

    it("EVALUATE_PER_TEST_TIMEOUT_MS is 25s", () => {
      expect(EVALUATE_PER_TEST_TIMEOUT_MS).toBe(25_000);
    });
  });
});
