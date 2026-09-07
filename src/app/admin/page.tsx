"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Users, FileCode, Trophy, AlertTriangle } from "lucide-react";

export default function AdminDashboardPage() {
  const supabase = createClient();
  const [stats, setStats] = useState({
    registered: 0,
    activeNow: 0,
    submissions: 0,
    violations: 0,
  });

  // Fetch initial counts
  useEffect(() => {
    async function fetchStats() {
      const [profiles, active, submissions, violations] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("exam_sessions").select("id", { count: "exact", head: true }).eq("status", "in_progress"),
        supabase.from("submissions").select("id", { count: "exact", head: true }),
        supabase.from("violations").select("id", { count: "exact", head: true }),
      ]);

      setStats({
        registered: profiles.count || 0,
        activeNow: active.count || 0,
        submissions: submissions.count || 0,
        violations: violations.count || 0,
      });
    }

    fetchStats();
  }, [supabase]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("admin-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "profiles" },
        () => setStats((prev) => ({ ...prev, registered: prev.registered + 1 }))
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "exam_sessions" },
        async () => {
          const { count } = await supabase
            .from("exam_sessions")
            .select("id", { count: "exact", head: true })
            .eq("status", "in_progress");
          setStats((prev) => ({ ...prev, activeNow: count || 0 }));
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "submissions" },
        () => setStats((prev) => ({ ...prev, submissions: prev.submissions + 1 }))
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "violations" },
        () => setStats((prev) => ({ ...prev, violations: prev.violations + 1 }))
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-gray-400 mt-1">Overview of Code Clash 2026</p>
      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-primary-light" />
            </div>
            <span className="text-sm text-gray-400">Registered</span>
          </div>
          <div className="text-3xl font-bold text-foreground">{stats.registered}</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-success/10 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-success" />
            </div>
            <span className="text-sm text-gray-400">Active Now</span>
          </div>
          <div className="text-3xl font-bold text-foreground">{stats.activeNow}</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-accent/10 rounded-lg flex items-center justify-center">
              <FileCode className="w-5 h-5 text-accent" />
            </div>
            <span className="text-sm text-gray-400">Submissions</span>
          </div>
          <div className="text-3xl font-bold text-foreground">{stats.submissions}</div>
        </div>

        <div className="bg-surface border border-border rounded-xl p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-danger/10 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <span className="text-sm text-gray-400">Violations</span>
          </div>
          <div className="text-3xl font-bold text-foreground">{stats.violations}</div>
        </div>
      </div>

      {/* Quick links */}
      <div className="grid md:grid-cols-3 gap-6">
        <a
          href="/admin/questions"
          className="bg-surface border border-border rounded-xl p-6 hover:border-primary/50 transition-colors"
        >
          <FileCode className="w-8 h-8 text-primary-light mb-3" />
          <h3 className="font-semibold text-foreground">Question Bank</h3>
          <p className="text-sm text-gray-400 mt-1">Add, edit, and manage exam questions</p>
        </a>

        <a
          href="/admin/leaderboard"
          className="bg-surface border border-border rounded-xl p-6 hover:border-primary/50 transition-colors"
        >
          <Trophy className="w-8 h-8 text-warning mb-3" />
          <h3 className="font-semibold text-foreground">Leaderboard</h3>
          <p className="text-sm text-gray-400 mt-1">View rankings and scores</p>
        </a>

        <a
          href="/admin/settings"
          className="bg-surface border border-border rounded-xl p-6 hover:border-primary/50 transition-colors"
        >
          <Settings className="w-8 h-8 text-accent mb-3" />
          <h3 className="font-semibold text-foreground">Settings</h3>
          <p className="text-sm text-gray-400 mt-1">Configure exam settings and anti-cheat</p>
        </a>
      </div>
    </div>
  );
}

function Settings(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
