"use client";

import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import type { TestCaseResult } from "@/types/database";

interface TestResultsProps {
  results: TestCaseResult[];
  isRunning: boolean;
  showHidden: boolean;
}

export default function TestResults({
  results,
  isRunning,
  showHidden,
}: TestResultsProps) {
  const sampleResults = results.filter((_, i) => !showHidden || true);
  const passed = sampleResults.filter((r) => r.passed).length;
  const total = sampleResults.length;

  return (
    <div className="border-t border-border bg-surface">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">Test Results</span>
          {isRunning && (
            <Loader2 size={14} className="animate-spin text-primary-light" />
          )}
        </div>
        {total > 0 && (
          <span
            className={`text-sm font-medium ${
              passed === total ? "text-success" : "text-warning"
            }`}
          >
            {passed}/{total} passed
          </span>
        )}
      </div>

      <div className="max-h-48 overflow-y-auto">
        {results.length === 0 && !isRunning && (
          <div className="p-4 text-center text-gray-500 text-sm">
            Run your code to see test results
          </div>
        )}

        {isRunning && results.length === 0 && (
          <div className="p-4 text-center text-gray-400 text-sm flex items-center justify-center gap-2">
            <Loader2 size={14} className="animate-spin" />
            Compiling and running...
          </div>
        )}

        {results.map((result, index) => (
          <div
            key={index}
            className={`px-4 py-2.5 border-b border-border last:border-0 flex items-start gap-3 ${
              result.passed ? "bg-success/5" : "bg-danger/5"
            }`}
          >
            <div className="mt-0.5">
              {result.passed ? (
                <CheckCircle2 size={16} className="text-success" />
              ) : result.error ? (
                <AlertTriangle size={16} className="text-danger" />
              ) : (
                <XCircle size={16} className="text-danger" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">
                  Test Case {index + 1}
                </span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded ${
                    result.passed
                      ? "bg-success/10 text-success"
                      : "bg-danger/10 text-danger"
                  }`}
                >
                  {result.passed ? "Passed" : "Failed"}
                </span>
              </div>
              {result.error && (
                <p className="text-xs text-danger mt-1 truncate">{result.error}</p>
              )}
              {!result.passed && result.actual !== undefined && (
                <div className="mt-1 text-xs font-mono text-gray-400">
                  <div>Expected: <span className="text-foreground">{result.expected || "(empty)"}</span></div>
                  <div>Got: <span className="text-foreground">{result.actual || "(empty)"}</span></div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
