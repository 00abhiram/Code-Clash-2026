"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Save, Loader2, Shield, Clock, Shuffle } from "lucide-react";

interface Settings {
  id: number;
  is_anti_cheat_enabled: boolean;
  exam1_unlock_at: string;
  exam2_unlock_at: string;
  exam1_duration_minutes: number;
  exam2_duration_minutes: number;
  exam1_pool_questions: boolean;
  exam2_pool_questions: boolean;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const supabase = createClient();

  useEffect(() => {
    async function fetchSettings() {
      const { data } = await supabase
        .from("settings")
        .select("*")
        .eq("id", 1)
        .single();

      if (data) {
        setSettings(data);
      } else {
        // Create default settings
        const defaults: Settings = {
          id: 1,
          is_anti_cheat_enabled: true,
          exam1_unlock_at: "2026-08-07T08:15:00Z",
          exam2_unlock_at: "2026-08-07T09:00:00Z",
          exam1_duration_minutes: 30,
          exam2_duration_minutes: 30,
          exam1_pool_questions: false,
          exam2_pool_questions: false,
        };
        await supabase.from("settings").upsert(defaults);
        setSettings(defaults);
      }
      setLoading(false);
    }
    fetchSettings();
  }, [supabase]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setSaveMessage("");

    const { error } = await supabase
      .from("settings")
      .update({
        is_anti_cheat_enabled: settings.is_anti_cheat_enabled,
        exam1_unlock_at: settings.exam1_unlock_at,
        exam2_unlock_at: settings.exam2_unlock_at,
        exam1_duration_minutes: settings.exam1_duration_minutes,
        exam2_duration_minutes: settings.exam2_duration_minutes,
        exam1_pool_questions: settings.exam1_pool_questions,
        exam2_pool_questions: settings.exam2_pool_questions,
      })
      .eq("id", 1);

    if (error) {
      setSaveMessage("Error saving settings");
    } else {
      setSaveMessage("Settings saved successfully!");
    }
    setSaving(false);
    setTimeout(() => setSaveMessage(""), 3000);
  };

  const updateSetting = <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    if (!settings) return;
    setSettings({ ...settings, [key]: value });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-primary-light animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Settings</h1>
          <p className="text-gray-400 mt-1">Configure exam and anti-cheat settings</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-light text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Save size={16} />
          )}
          Save Changes
        </button>
      </div>

      {saveMessage && (
        <div
          className={`p-3 rounded-lg text-sm font-medium ${
            saveMessage.includes("Error")
              ? "bg-danger/10 border border-danger/30 text-danger"
              : "bg-success/10 border border-success/30 text-success"
          }`}
        >
          {saveMessage}
        </div>
      )}

      {/* Anti-Cheat Settings */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="w-5 h-5 text-primary-light" />
          <h2 className="text-lg font-bold text-foreground">Anti-Cheat Settings</h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-surface-light rounded-lg">
            <div>
              <div className="font-medium text-foreground">Enable Anti-Cheat</div>
              <div className="text-sm text-gray-400">
                When enabled: fullscreen required, tab switching tracked, shortcuts
                blocked. Disable for testing.
              </div>
            </div>
            <button
              onClick={() =>
                updateSetting(
                  "is_anti_cheat_enabled",
                  !settings?.is_anti_cheat_enabled
                )
              }
              className={`relative w-12 h-6 rounded-full transition-colors ${
                settings?.is_anti_cheat_enabled ? "bg-success" : "bg-gray-600"
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  settings?.is_anti_cheat_enabled
                    ? "left-7"
                    : "left-1"
                }`}
              />
            </button>
          </div>

          <div className="p-4 bg-warning/5 border border-warning/20 rounded-lg">
            <p className="text-sm text-warning">
              <strong>Developer Toggle:</strong> Turn off anti-cheat to test
              exams without fullscreen lock, tab restrictions, or keyboard
              blocking.
            </p>
          </div>
        </div>
      </div>

      {/* Exam 1 Settings */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-5 h-5 text-primary-light" />
          <h2 className="text-lg font-bold text-foreground">
            Round 1: Test-Driven Development
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Unlock Time (IST)
            </label>
            <input
              type="datetime-local"
              value={
                settings?.exam1_unlock_at
                  ? new Date(
                      new Date(settings.exam1_unlock_at).getTime() +
                        5.5 * 60 * 60 * 1000
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
              onChange={(e) => {
                const local = new Date(e.target.value);
                const utc = new Date(
                  local.getTime() - 5.5 * 60 * 60 * 1000
                );
                updateSetting("exam1_unlock_at", utc.toISOString());
              }}
              className="w-full px-4 py-2.5 bg-surface-light border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              min={5}
              max={120}
              value={settings?.exam1_duration_minutes || 30}
              onChange={(e) =>
                updateSetting(
                  "exam1_duration_minutes",
                  parseInt(e.target.value) || 30
                )
              }
              className="w-full px-4 py-2.5 bg-surface-light border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between p-4 bg-surface-light rounded-lg">
          <div className="flex items-center gap-3">
            <Shuffle className="w-4 h-4 text-gray-400" />
            <div>
              <div className="font-medium text-foreground text-sm">Pool Questions</div>
              <div className="text-xs text-gray-400">
                Randomly assign a subset of questions to each student
              </div>
            </div>
          </div>
          <button
            onClick={() =>
              updateSetting("exam1_pool_questions", !settings?.exam1_pool_questions)
            }
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings?.exam1_pool_questions ? "bg-success" : "bg-gray-600"
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                settings?.exam1_pool_questions ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Exam 2 Settings */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <Clock className="w-5 h-5 text-accent" />
          <h2 className="text-lg font-bold text-foreground">
            Round 2: Code Debugging
          </h2>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Unlock Time (IST)
            </label>
            <input
              type="datetime-local"
              value={
                settings?.exam2_unlock_at
                  ? new Date(
                      new Date(settings.exam2_unlock_at).getTime() +
                        5.5 * 60 * 60 * 1000
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
              onChange={(e) => {
                const local = new Date(e.target.value);
                const utc = new Date(
                  local.getTime() - 5.5 * 60 * 60 * 1000
                );
                updateSetting("exam2_unlock_at", utc.toISOString());
              }}
              className="w-full px-4 py-2.5 bg-surface-light border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              min={5}
              max={120}
              value={settings?.exam2_duration_minutes || 30}
              onChange={(e) =>
                updateSetting(
                  "exam2_duration_minutes",
                  parseInt(e.target.value) || 30
                )
              }
              className="w-full px-4 py-2.5 bg-surface-light border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between p-4 bg-surface-light rounded-lg">
          <div className="flex items-center gap-3">
            <Shuffle className="w-4 h-4 text-gray-400" />
            <div>
              <div className="font-medium text-foreground text-sm">Pool Questions</div>
              <div className="text-xs text-gray-400">
                Randomly assign a subset of questions to each student
              </div>
            </div>
          </div>
          <button
            onClick={() =>
              updateSetting("exam2_pool_questions", !settings?.exam2_pool_questions)
            }
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings?.exam2_pool_questions ? "bg-success" : "bg-gray-600"
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                settings?.exam2_pool_questions ? "left-7" : "left-1"
              }`}
            />
          </button>
        </div>
      </div>
    </div>
  );
}
