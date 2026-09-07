/**
 * CODE CLASH 2026 — Seed script
 * Populates the database with the two sample problems used for dry-runs:
 *
 *   Round 1 (TDD):       Find the GCD (Python)         — 2 sample + 3 hidden tests
 *   Round 2 (DEBUGGING): Fix the Fibonacci Generator (Java) — 2 sample + 2 hidden tests
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (bypasses RLS). Reads .env.local if present.
 * Idempotent: re-running updates existing questions and replaces their test cases.
 *
 * Usage:
 *   node scripts/seed-questions.ts
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function loadEnvFile(filePath: string): void {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    return;
  }
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

interface SeedTestCase {
  is_sample: boolean;
  stdin: string;
  expected_stdout: string;
  description: string;
  sort_order: number;
}

interface SeedQuestion {
  exam_number: number;
  question_type: "TDD" | "DEBUGGING";
  title: string;
  description: string;
  starter_code: string;
  solution_code: string;
  language: string;
  difficulty: "easy" | "medium" | "hard";
  sort_order: number;
  test_cases: SeedTestCase[];
}

const PROBLEMS: SeedQuestion[] = [
  // ------------------------------------------------------------
  // Problem 1 — Round 1 (TDD) · Python · GCD
  // ------------------------------------------------------------
  {
    exam_number: 1,
    question_type: "TDD",
    title: "Find the GCD (Greatest Common Divisor)",
    description: `# Find the GCD

Write a program that reads two non-negative integers **A** and **B** from a single line of standard input and prints their **Greatest Common Divisor (GCD)** — the largest positive integer that divides both without leaving a remainder.

## Input Format

- A single line containing two space-separated integers \`A\` and \`B\`.

## Output Format

- Print a single integer: the GCD of \`A\` and \`B\`.

## Constraints

- \`0 <= A, B <= 10^9\`
- \`A\` and \`B\` are never both zero.

## Examples

| Input | Output |
| ----- | ------ |
| \`12 8\` | \`4\` |
| \`17 13\` | \`1\` |

## Note

- \`gcd(A, 0) == A\`
- The Euclidean algorithm runs in O(log min(A, B)) and is recommended.`,
    starter_code: `import sys

def gcd(a: int, b: int) -> int:
    # TODO: Implement the Euclidean algorithm here
    pass


if __name__ == "__main__":
    a, b = map(int, sys.stdin.readline().split())
    print(gcd(a, b))
`,
    solution_code: `import sys

def gcd(a: int, b: int) -> int:
    while b != 0:
        a, b = b, a % b
    return a


if __name__ == "__main__":
    a, b = map(int, sys.stdin.readline().split())
    print(gcd(a, b))
`,
    language: "python",
    difficulty: "easy",
    sort_order: 0,
    test_cases: [
      {
        is_sample: true,
        stdin: "12 8",
        expected_stdout: "4",
        description: "Sample 1: gcd(12, 8) = 4",
        sort_order: 0,
      },
      {
        is_sample: true,
        stdin: "17 13",
        expected_stdout: "1",
        description: "Sample 2: gcd(17, 13) = 1 (coprime)",
        sort_order: 1,
      },
      {
        is_sample: false,
        stdin: "48 36",
        expected_stdout: "12",
        description: "Hidden 1: gcd(48, 36) = 12",
        sort_order: 2,
      },
      {
        is_sample: false,
        stdin: "100 10",
        expected_stdout: "10",
        description: "Hidden 2: gcd(100, 10) = 10 (divisor)",
        sort_order: 3,
      },
      {
        is_sample: false,
        stdin: "0 5",
        expected_stdout: "5",
        description: "Hidden 3: gcd(0, 5) = 5 (zero edge case)",
        sort_order: 4,
      },
    ],
  },

  // ------------------------------------------------------------
  // Problem 2 — Round 2 (DEBUGGING) · Java · Buggy Fibonacci
  // ------------------------------------------------------------
  {
    exam_number: 2,
    question_type: "DEBUGGING",
    title: "Fix the Fibonacci Generator",
    description: `# Fix the Fibonacci Generator

The program below reads a single integer **N** from standard input and is supposed to print the **N-th Fibonacci number** using the definition:

- \`F(0) = 0\`
- \`F(1) = 1\`
- \`F(N) = F(N - 1) + F(N - 2)\` for \`N >= 2\`

However, it contains **two bugs** and currently produces incorrect output. Find and fix them so the program passes all test cases.

## Input Format

- A single line containing one integer \`N\`.

## Output Format

- Print a single integer: \`F(N)\`.

## Constraints

- \`0 <= N <= 30\`

## Examples

| Input | Output |
| ----- | ------ |
| \`5\` | \`5\` |
| \`7\` | \`13\` |

## Notes

- Do **not** change the class name (\`Main\`), the method signature, or the output format.
- The Fibonacci sequence starts: 0, 1, 1, 2, 3, 5, 8, 13, 21, 34, 55, ...`,
    starter_code: `import java.util.Scanner;

public class Main {
    public static int fib(int n) {
        if (n <= 1) {
            return 1;
        }
        return fib(n - 1) + fib(n - 1);
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        System.out.println(fib(n));
    }
}
`,
    solution_code: `import java.util.Scanner;

public class Main {
    public static int fib(int n) {
        if (n <= 1) {
            return n;
        }
        return fib(n - 1) + fib(n - 2);
    }

    public static void main(String[] args) {
        Scanner sc = new Scanner(System.in);
        int n = sc.nextInt();
        System.out.println(fib(n));
    }
}
`,
    language: "java",
    difficulty: "easy",
    sort_order: 0,
    test_cases: [
      {
        is_sample: true,
        stdin: "5",
        expected_stdout: "5",
        description: "Sample 1: F(5) = 5",
        sort_order: 0,
      },
      {
        is_sample: true,
        stdin: "7",
        expected_stdout: "13",
        description: "Sample 2: F(7) = 13",
        sort_order: 1,
      },
      {
        is_sample: false,
        stdin: "10",
        expected_stdout: "55",
        description: "Hidden 1: F(10) = 55",
        sort_order: 2,
      },
      {
        is_sample: false,
        stdin: "2",
        expected_stdout: "1",
        description: "Hidden 2: F(2) = 1 (catches the base-case bug)",
        sort_order: 3,
      },
    ],
  },
];

async function upsertQuestion(
  supabase: SupabaseClient,
  problem: SeedQuestion
): Promise<{ id: string; created: boolean }> {
  const { exam_number, question_type, title, description, starter_code, solution_code, language, difficulty, sort_order } = problem;

  const { data: existing } = await supabase
    .from("questions")
    .select("id")
    .eq("title", title)
    .maybeSingle();

  let questionId: string;
  let created: boolean;

  if (existing?.id) {
    const { error } = await supabase
      .from("questions")
      .update({ exam_number, question_type, description, starter_code, solution_code, language, difficulty, sort_order, is_active: true })
      .eq("id", existing.id);
    if (error) throw new Error(`update question "${title}": ${error.message}`);
    questionId = existing.id;
    created = false;
  } else {
    const { data, error } = await supabase
      .from("questions")
      .insert({ exam_number, question_type, title, description, starter_code, solution_code, language, difficulty, sort_order, is_active: true })
      .select("id")
      .single();
    if (error || !data) throw new Error(`insert question "${title}": ${error?.message}`);
    questionId = data.id;
    created = true;
  }

  // Replace all test cases so the seed stays the source of truth
  const { error: deleteError } = await supabase
    .from("test_cases")
    .delete()
    .eq("question_id", questionId);
  if (deleteError) throw new Error(`clear test cases for "${title}": ${deleteError.message}`);

  const rows = problem.test_cases.map((tc) => ({ question_id: questionId, ...tc }));
  const { error: insertError } = await supabase.from("test_cases").insert(rows);
  if (insertError) throw new Error(`insert test cases for "${title}": ${insertError.message}`);

  return { id: questionId, created };
}

async function main(): Promise<void> {
  loadEnvFile(path.join(rootDir, ".env.local"));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error(
      "Missing Supabase credentials. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (or the environment) and re-run."
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  console.log("Seeding Code Clash 2026 sample problems...\n");

  for (const problem of PROBLEMS) {
    const { created } = await upsertQuestion(supabase, problem);
    const sampleCount = problem.test_cases.filter((tc) => tc.is_sample).length;
    const hiddenCount = problem.test_cases.length - sampleCount;
    console.log(
      `  [${created ? "created" : "updated"}] Round ${problem.exam_number} (${problem.question_type}) — ${problem.title} — ${sampleCount} sample + ${hiddenCount} hidden tests`
    );
  }

  const { count, error } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .in("title", PROBLEMS.map((p) => p.title));
  if (error) throw new Error(`verify count: ${error.message}`);

  console.log(`\nDone. ${count} seeded question(s) now in the question bank.`);
  console.log("Round 1 unlocks at the configured exam1_unlock_at; Round 2 at exam2_unlock_at (see admin > Settings).");
}

main().catch((err) => {
  console.error("Seed failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
