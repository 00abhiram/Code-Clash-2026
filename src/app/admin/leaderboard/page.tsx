"use client";

import { useState, useEffect } from "react";
import { Trophy, Medal, Clock, Code2, Bug, Loader2, RefreshCw } from "lucide-react";

interface LeaderboardEntry {
  rank: number;
  user_id: string;
  full_name: string;
  roll_no: string;
  branch: string;
  total_hidden_passed: number;
  total_hidden_total: number;
  total_sample_passed: number;
  total_sample_total: number;
  total_execution_time_ms: number;
  time_taken_seconds: number;
  questions_attempted: number;
}

interface LeaderboardData {
  exam: number;
  entries: LeaderboardEntry[];
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<1 | 2>(1);
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLeaderboard = async (exam: 1 | 2, isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const res = await fetch(`/api/leaderboard?exam=${exam}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error("Failed to fetch leaderboard:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLeaderboard(activeTab);
  }, [activeTab]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatExecTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-400" />;
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-300" />;
    if (rank === 3) return <Medal className="w-5 h-5 text-amber-600" />;
    return <span className="text-gray-500 font-mono text-sm w-5 text-center">#{rank}</span>;
  };

  const tabs = [
    { id: 1 as const, label: "TDD Leaderboard", icon: Code2, color: "primary" },
    { id: 2 as const, label: "Debugging Leaderboard", icon: Bug, color: "accent" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Leaderboard</h1>
          <p className="text-gray-400 mt-1">
            Separate rankings for each competition format
          </p>
        </div>
        <button
          onClick={() => fetchLeaderboard(activeTab, true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-lg text-gray-300 hover:text-foreground hover:bg-surface-light transition-colors disabled:opacity-50"
        >
          <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-surface p-1 rounded-xl border border-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
              activeTab === tab.id
                ? tab.color === "primary"
                  ? "bg-primary text-white shadow-lg"
                  : "bg-accent text-white shadow-lg"
                : "text-gray-400 hover:text-foreground hover:bg-surface-light"
            }`}
          >
            <tab.icon size={18} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Leaderboard Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-primary-light animate-spin" />
        </div>
      ) : !data || data.entries.length === 0 ? (
        <div className="bg-surface border border-border rounded-xl p-12 text-center">
          <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">No submissions yet</p>
          <p className="text-gray-500 text-sm mt-1">
            Rankings will appear once students start submitting solutions.
          </p>
        </div>
      ) : (
        <div className="bg-surface border border-border rounded-xl overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-surface-light border-b border-border text-sm font-medium text-gray-400">
            <div className="col-span-1">Rank</div>
            <div className="col-span-4">Student</div>
            <div className="col-span-2">Branch</div>
            <div className="col-span-2 text-center">Hidden Tests</div>
            <div className="col-span-1 text-center">Exec Time</div>
            <div className="col-span-1 text-center">Time Taken</div>
            <div className="col-span-1 text-center">Solved</div>
          </div>

          {/* Rows */}
          {data.entries.map((entry) => (
            <div
              key={entry.user_id}
              className={`grid grid-cols-12 gap-4 px-6 py-4 border-b border-border last:border-0 hover:bg-surface-light/50 transition-colors ${
                entry.rank <= 3 ? "bg-surface-light/30" : ""
              }`}
            >
              <div className="col-span-1 flex items-center">
                {getRankIcon(entry.rank)}
              </div>
              <div className="col-span-4">
                <div className="font-medium text-foreground">{entry.full_name}</div>
                <div className="text-xs text-gray-500">{entry.roll_no}</div>
              </div>
              <div className="col-span-2 text-sm text-gray-400 flex items-center">
                {entry.branch}
              </div>
              <div className="col-span-2 flex items-center justify-center">
                <div className="text-center">
                  <span className="font-mono text-sm text-foreground">
                    {entry.total_hidden_passed}/{entry.total_hidden_total}
                  </span>
                  <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
                    <div
                      className={`h-1.5 rounded-full ${
                        entry.total_hidden_total > 0 &&
                        entry.total_hidden_passed === entry.total_hidden_total
                          ? "bg-success"
                          : "bg-primary-light"
                      }`}
                      style={{
                        width: `${
                          entry.total_hidden_total > 0
                            ? (entry.total_hidden_passed / entry.total_hidden_total) * 100
                            : 0
                        }%`,
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="col-span-1 flex items-center justify-center text-sm text-gray-400">
                {formatExecTime(entry.total_execution_time_ms)}
              </div>
              <div className="col-span-1 flex items-center justify-center">
                <div className="flex items-center gap-1 text-sm text-gray-400">
                  <Clock size={12} />
                  {formatTime(entry.time_taken_seconds)}
                </div>
              </div>
              <div className="col-span-1 flex items-center justify-center text-sm text-gray-400">
                {entry.questions_attempted}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scoring info */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="font-semibold text-foreground mb-3">Scoring Algorithm</h3>
        <ul className="space-y-1.5 text-sm text-gray-400">
          <li>1. <span className="text-gray-300">Hidden test cases passed %</span> — Highest priority</li>
          <li>2. <span className="text-gray-300">Execution time</span> — Lower is better (tie-breaker)</li>
          <li>3. <span className="text-gray-300">Time taken</span> — Faster submissions win (final tie-breaker)</li>
        </ul>
      </div>
    </div>
  );
}
