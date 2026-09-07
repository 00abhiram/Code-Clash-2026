import { describe, it, expect } from "vitest";

describe("Settings API contract", () => {
  const defaultSettings = {
    id: 1,
    is_anti_cheat_enabled: true,
    exam1_unlock_at: "2026-08-07T08:15:00Z",
    exam2_unlock_at: "2026-08-07T09:00:00Z",
    exam1_duration_minutes: 30,
    exam2_duration_minutes: 30,
    exam1_pool_questions: false,
    exam2_pool_questions: false,
  };

  describe("default settings alignment", () => {
    it("server defaults match PRD dates", () => {
      expect(defaultSettings.exam1_unlock_at).toBe("2026-08-07T08:15:00Z");
      expect(defaultSettings.exam2_unlock_at).toBe("2026-08-07T09:00:00Z");
    });

    it("default duration is 30 minutes", () => {
      expect(defaultSettings.exam1_duration_minutes).toBe(30);
      expect(defaultSettings.exam2_duration_minutes).toBe(30);
    });

    it("anti-cheat is enabled by default", () => {
      expect(defaultSettings.is_anti_cheat_enabled).toBe(true);
    });

    it("question pooling is disabled by default", () => {
      expect(defaultSettings.exam1_pool_questions).toBe(false);
      expect(defaultSettings.exam2_pool_questions).toBe(false);
    });
  });

  describe("settings shape validation", () => {
    it("has all required fields", () => {
      const requiredFields = [
        "id",
        "is_anti_cheat_enabled",
        "exam1_unlock_at",
        "exam2_unlock_at",
        "exam1_duration_minutes",
        "exam2_duration_minutes",
        "exam1_pool_questions",
        "exam2_pool_questions",
      ];
      for (const field of requiredFields) {
        expect(defaultSettings).toHaveProperty(field);
      }
    });

    it("unlock times are valid ISO strings", () => {
      expect(() => new Date(defaultSettings.exam1_unlock_at)).not.toThrow();
      expect(() => new Date(defaultSettings.exam2_unlock_at)).not.toThrow();
      const parsed = new Date(defaultSettings.exam1_unlock_at);
      expect(parsed.getTime()).not.toBeNaN();
    });

    it("duration is positive integer", () => {
      expect(defaultSettings.exam1_duration_minutes).toBeGreaterThan(0);
      expect(Number.isInteger(defaultSettings.exam1_duration_minutes)).toBe(true);
    });
  });
});
