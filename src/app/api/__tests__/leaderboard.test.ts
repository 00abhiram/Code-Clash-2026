import { describe, it, expect } from "vitest";

/**
 * Leaderboard ranking logic tests.
 * Tests the ordering algorithm: hidden pass rate DESC → execution time ASC → time taken ASC.
 */

interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  hidden_passed: number;
  hidden_total: number;
  exec_time_ms: number;
  time_taken_secs: number;
}

function rankEntries(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  return [...entries].sort((a, b) => {
    // 1. Hidden test pass rate DESC
    const aRate = a.hidden_total > 0 ? a.hidden_passed / a.hidden_total : 0;
    const bRate = b.hidden_total > 0 ? b.hidden_passed / b.hidden_total : 0;
    if (bRate !== aRate) return bRate - aRate;

    // 2. Execution time ASC (lower is better)
    if (a.exec_time_ms !== b.exec_time_ms) return a.exec_time_ms - b.exec_time_ms;

    // 3. Time taken ASC
    return a.time_taken_secs - b.time_taken_secs;
  });
}

describe("Leaderboard ranking logic", () => {
  it("ranks higher hidden pass rate first", () => {
    const entries: LeaderboardEntry[] = [
      { user_id: "1", full_name: "Alice", hidden_passed: 3, hidden_total: 5, exec_time_ms: 1000, time_taken_secs: 100 },
      { user_id: "2", full_name: "Bob", hidden_passed: 5, hidden_total: 5, exec_time_ms: 2000, time_taken_secs: 200 },
    ];
    const ranked = rankEntries(entries);
    expect(ranked[0].user_id).toBe("2"); // Bob (100%) > Alice (60%)
    expect(ranked[1].user_id).toBe("1");
  });

  it("uses execution time as tiebreaker when pass rates are equal", () => {
    const entries: LeaderboardEntry[] = [
      { user_id: "1", full_name: "Alice", hidden_passed: 5, hidden_total: 5, exec_time_ms: 2000, time_taken_secs: 200 },
      { user_id: "2", full_name: "Bob", hidden_passed: 5, hidden_total: 5, exec_time_ms: 1000, time_taken_secs: 100 },
    ];
    const ranked = rankEntries(entries);
    expect(ranked[0].user_id).toBe("2"); // Bob faster
    expect(ranked[1].user_id).toBe("1");
  });

  it("uses time taken as second tiebreaker", () => {
    const entries: LeaderboardEntry[] = [
      { user_id: "1", full_name: "Alice", hidden_passed: 5, hidden_total: 5, exec_time_ms: 1000, time_taken_secs: 200 },
      { user_id: "2", full_name: "Bob", hidden_passed: 5, hidden_total: 5, exec_time_ms: 1000, time_taken_secs: 100 },
    ];
    const ranked = rankEntries(entries);
    expect(ranked[0].user_id).toBe("2"); // Bob less time taken
    expect(ranked[1].user_id).toBe("1");
  });

  it("handles students with no submissions (0/0 hidden)", () => {
    const entries: LeaderboardEntry[] = [
      { user_id: "1", full_name: "Alice", hidden_passed: 3, hidden_total: 5, exec_time_ms: 1000, time_taken_secs: 100 },
      { user_id: "2", full_name: "Bob", hidden_passed: 0, hidden_total: 0, exec_time_ms: 0, time_taken_secs: 0 },
    ];
    const ranked = rankEntries(entries);
    expect(ranked[0].user_id).toBe("1"); // Alice has actual score
    expect(ranked[1].user_id).toBe("2");
  });

  it("handles empty leaderboard", () => {
    const ranked = rankEntries([]);
    expect(ranked).toEqual([]);
  });

  it("handles single entry", () => {
    const entries: LeaderboardEntry[] = [
      { user_id: "1", full_name: "Alice", hidden_passed: 5, hidden_total: 5, exec_time_ms: 1000, time_taken_secs: 100 },
    ];
    const ranked = rankEntries(entries);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].user_id).toBe("1");
  });

  it("deterministic: same data produces same order", () => {
    const entries: LeaderboardEntry[] = [
      { user_id: "1", full_name: "Alice", hidden_passed: 3, hidden_total: 5, exec_time_ms: 1500, time_taken_secs: 150 },
      { user_id: "2", full_name: "Bob", hidden_passed: 4, hidden_total: 5, exec_time_ms: 1200, time_taken_secs: 120 },
      { user_id: "3", full_name: "Charlie", hidden_passed: 5, hidden_total: 5, exec_time_ms: 900, time_taken_secs: 90 },
    ];
    const ranked1 = rankEntries(entries);
    const ranked2 = rankEntries(entries);
    expect(ranked1.map((e) => e.user_id)).toEqual(ranked2.map((e) => e.user_id));
  });

  it("three-way tie: pass rate → exec time → time taken", () => {
    const entries: LeaderboardEntry[] = [
      { user_id: "1", full_name: "Alice", hidden_passed: 5, hidden_total: 5, exec_time_ms: 1000, time_taken_secs: 150 },
      { user_id: "2", full_name: "Bob", hidden_passed: 5, hidden_total: 5, exec_time_ms: 1000, time_taken_secs: 100 },
      { user_id: "3", full_name: "Charlie", hidden_passed: 5, hidden_total: 5, exec_time_ms: 1000, time_taken_secs: 50 },
    ];
    const ranked = rankEntries(entries);
    expect(ranked[0].user_id).toBe("3"); // Fastest time_taken
    expect(ranked[1].user_id).toBe("2");
    expect(ranked[2].user_id).toBe("1");
  });
});
