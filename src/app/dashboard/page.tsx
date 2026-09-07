"use client";

import { useAuth } from "@/hooks/useAuth";
import Link from "next/link";
import { Code2, Bug, Clock, Lock, CheckCircle2 } from "lucide-react";

export default function DashboardPage() {
  const { profile } = useAuth();

  const exams = [
    {
      id: 1,
      title: "Test-Driven Development",
      description: "Write code to pass hidden test cases. Prove your TDD skills.",
      icon: Code2,
      unlockTime: "1:45 PM IST",
      duration: "30 minutes",
      color: "primary",
      languages: "Python, Java, C, C++",
    },
    {
      id: 2,
      title: "Code Debugging",
      description: "Find and fix bugs in pre-written code. Test your debugging eye.",
      icon: Bug,
      unlockTime: "2:30 PM IST",
      duration: "30 minutes",
      color: "accent",
      languages: "Python, Java, C, C++",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-3xl font-bold text-foreground">
          Welcome, <span className="text-primary-light">{profile?.full_name?.split(" ")[0]}</span>
        </h1>
        <p className="text-gray-400 mt-1">
          {profile?.roll_no} — {profile?.branch}
        </p>
      </div>

      {/* Exam Cards */}
      <div className="grid md:grid-cols-2 gap-6">
        {exams.map((exam) => (
          <div
            key={exam.id}
            className="bg-surface border border-border rounded-2xl p-8 hover:border-primary/50 transition-all"
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                  exam.color === "primary" ? "bg-primary/10" : "bg-accent/10"
                }`}
              >
                <exam.icon
                  className={`w-6 h-6 ${
                    exam.color === "primary" ? "text-primary-light" : "text-accent"
                  }`}
                />
              </div>
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <Clock size={14} />
                {exam.duration}
              </div>
            </div>

            <h3 className="text-xl font-bold text-foreground mb-2">
              Round {exam.id}: {exam.title}
            </h3>
            <p className="text-gray-400 text-sm mb-4">{exam.description}</p>

            <div className="flex items-center gap-4 text-xs text-gray-500 mb-6">
              <span>Languages: {exam.languages}</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm">
                <Lock size={14} className="text-gray-500" />
                <span className="text-gray-400">Unlocks at {exam.unlockTime}</span>
              </div>
              <Link
                href={`/dashboard/exam/${exam.id}`}
                className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${
                  exam.color === "primary"
                    ? "bg-primary hover:bg-primary-light text-white"
                    : "bg-accent hover:bg-accent-light text-white"
                }`}
              >
                Enter Exam
              </Link>
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="bg-surface border border-border rounded-xl p-6">
        <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
          <CheckCircle2 size={18} className="text-success" />
          Exam Rules
        </h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li>• Each round is strictly 30 minutes once started</li>
          <li>• Fullscreen mode is mandatory during the exam</li>
          <li>• Tab switching is monitored — 3 violations = auto-submit</li>
          <li>• Exiting fullscreen 2 times = auto-submit and lockout</li>
          <li>• Right-click, copy/paste, and DevTools are disabled</li>
          <li>• All times are server-enforced (IST)</li>
        </ul>
      </div>
    </div>
  );
}
