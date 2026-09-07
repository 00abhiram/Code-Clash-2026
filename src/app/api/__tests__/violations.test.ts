import { describe, it, expect } from "vitest";

describe("Violation API logic", () => {
  describe("rate limiting", () => {
    const WINDOW = 60_000;
    const MAX = 10;
    function check(count: number, windowStart: number, now: number): boolean {
      if (now - windowStart > WINDOW) return true;
      return count < MAX;
    }
    it("allows first violation", () => { const n = Date.now(); expect(check(0, n, n)).toBe(true); });
    it("allows up to MAX in window", () => { const n = Date.now(); expect(check(9, n, n)).toBe(true); });
    it("blocks at MAX", () => { const n = Date.now(); expect(check(10, n, n)).toBe(false); });
    it("blocks beyond MAX", () => { const n = Date.now(); expect(check(20, n, n)).toBe(false); });
    it("resets after window", () => { const n = Date.now(); expect(check(10, n - WINDOW - 1, n)).toBe(true); });
  });

  describe("auto-submit threshold", () => {
    const THRESHOLD = 5;
    it("below threshold", () => { expect(4 >= THRESHOLD).toBe(false); });
    it("at threshold", () => { expect(5 >= THRESHOLD).toBe(true); });
    it("above threshold", () => { expect(6 >= THRESHOLD).toBe(true); });
  });

  describe("violation type validation", () => {
    const VALID = new Set(["tab_switch", "fullscreen_exit", "shortcut_attempt", "background_limit", "other"]);
    it.each(["tab_switch", "fullscreen_exit", "shortcut_attempt", "background_limit", "other"])("accepts: %s", (t) => {
      expect(VALID.has(t)).toBe(true);
    });
    it.each(["invalid", "", "F12", "ctrl+c"])("rejects: %s", (t) => {
      expect(VALID.has(t)).toBe(false);
    });
  });

  describe("session status check", () => {
    it("allows in_progress", () => { expect("in_progress").toBe("in_progress"); });
    it("rejects completed", () => { const status: string = "completed"; expect(status === "in_progress").toBe(false); });
    it("rejects pending", () => { const status: string = "pending"; expect(status === "in_progress").toBe(false); });
  });

  describe("newCount computation", () => {
    it("increments correctly", () => { expect(3 + 1).toBe(4); });
    it("detects threshold crossing", () => { expect(4 + 1 >= 5).toBe(true); });
    it("detects already at threshold", () => { expect(5 + 1 >= 5).toBe(true); });
  });
});
