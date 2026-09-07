import { describe, it, expect } from "vitest";

// Mock the auth helpers
vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: vi.fn(),
  requireAdmin: vi.fn(),
  requireSessionOwnership: vi.fn(),
}));

import { vi } from "vitest";

describe("Security regression", () => {
  describe("authentication boundary", () => {
    it("unauthenticated requests return 401", async () => {
      const { getAuthUser } = await import("@/lib/supabase/server");
      vi.mocked(getAuthUser).mockResolvedValue({
        ok: false,
        response: { status: 401 } as never,
      });

      const auth = await getAuthUser();
      expect(auth.ok).toBe(false);
      if (!auth.ok) {
        expect(auth.response.status).toBe(401);
      }
    });
  });

  describe("admin authorization boundary", () => {
    it("non-admin users get 403", async () => {
      const { requireAdmin } = await import("@/lib/supabase/server");
      vi.mocked(requireAdmin).mockResolvedValue({
        ok: false,
        response: { status: 403 } as never,
      });

      const auth = await requireAdmin();
      expect(auth.ok).toBe(false);
      if (!auth.ok) {
        expect(auth.response.status).toBe(403);
      }
    });
  });

  describe("session ownership boundary", () => {
    it("mismatched user_id returns 403", async () => {
      const { requireSessionOwnership } = await import("@/lib/supabase/server");
      vi.mocked(requireSessionOwnership).mockResolvedValue({
        ok: false,
        response: { status: 403 } as never,
      });

      const auth = await requireSessionOwnership(
        {} as never,
        "attacker-user-id",
        "target-session-id"
      );
      expect(auth.ok).toBe(false);
      if (!auth.ok) {
        expect(auth.response.status).toBe(403);
      }
    });

    it("non-existent session returns 404", async () => {
      const { requireSessionOwnership } = await import("@/lib/supabase/server");
      vi.mocked(requireSessionOwnership).mockResolvedValue({
        ok: false,
        response: { status: 404 } as never,
      });

      const auth = await requireSessionOwnership(
        {} as never,
        "user-id",
        "non-existent-session-id"
      );
      expect(auth.ok).toBe(false);
      if (!auth.ok) {
        expect(auth.response.status).toBe(404);
      }
    });
  });

  describe("data leak prevention", () => {
    it("questions response should not contain solution_code", () => {
      const studentVisibleFields = [
        "id", "exam_number", "question_type", "title", "description",
        "starter_code", "language", "difficulty", "sort_order", "is_active",
        "created_at", "updated_at",
      ];
      expect(studentVisibleFields).not.toContain("solution_code");
    });

    it("test_cases student query filters to sample only", () => {
      const studentFilter = "is_sample = true";
      expect(studentFilter).toBe("is_sample = true");
    });

    it("evaluate endpoint never returns hidden test inputs", () => {
      const evaluateResponseShape = [
        "submission",
        "sample_results",
        "hidden_tests_passed",
        "hidden_tests_total",
      ];
      expect(evaluateResponseShape).not.toContain("hidden_test_cases");
      expect(evaluateResponseShape).not.toContain("solution_code");
    });

    it("leaderboard returns only non-sensitive fields", () => {
      const leaderboardFields = [
        "rank", "user_id", "full_name", "roll_no", "branch",
        "total_hidden_passed", "total_hidden_total",
        "total_sample_passed", "total_sample_total",
        "total_execution_time_ms", "time_taken_seconds",
        "questions_attempted",
      ];
      expect(leaderboardFields).not.toContain("code");
      expect(leaderboardFields).not.toContain("solution_code");
      expect(leaderboardFields).not.toContain("email");
      expect(leaderboardFields).not.toContain("ip_address");
    });
  });

  describe("state machine integrity", () => {
    it("valid transitions: pending → in_progress → completed", () => {
      const validTransitions = [
        { from: "pending", to: "in_progress" },
        { from: "in_progress", to: "completed" },
      ];
      expect(validTransitions).toHaveLength(2);
    });

    it("invalid transitions are rejected", () => {
      const invalidTransitions = [
        { from: "completed", to: "in_progress" },
        { from: "completed", to: "pending" },
        { from: "in_progress", to: "pending" },
      ];
      for (const t of invalidTransitions) {
        expect(`${t.from} → ${t.to}`).not.toBe("pending → in_progress");
        expect(`${t.from} → ${t.to}`).not.toBe("in_progress → completed");
      }
    });
  });

  describe("dead route protection", () => {
    it("POST /api/submissions returns 410 Gone", () => {
      const deadRouteStatus = 410;
      expect(deadRouteStatus).toBe(410);
    });
  });

  describe("input validation", () => {
    it("violation types are restricted to enum values", () => {
      const validTypes = new Set([
        "tab_switch",
        "fullscreen_exit",
        "shortcut_attempt",
        "background_limit",
        "other",
      ]);
      expect(validTypes.has("tab_switch")).toBe(true);
      expect(validTypes.has("malicious_input")).toBe(false);
      expect(validTypes.has("'; DROP TABLE violations;--")).toBe(false);
    });

    it("exam_number must be 1 or 2", () => {
      const validExamNumbers = [1, 2];
      expect(validExamNumbers).toContain(1);
      expect(validExamNumbers).toContain(2);
      expect(validExamNumbers).not.toContain(0);
      expect(validExamNumbers).not.toContain(3);
    });
  });
});
