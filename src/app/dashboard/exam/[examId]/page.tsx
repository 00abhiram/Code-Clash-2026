"use client";

import { useAuth } from "@/hooks/useAuth";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Lock, Clock, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface Settings {
  exam1_unlock_at: string;
  exam2_unlock_at: string;
  exam1_duration_minutes: number;
  exam2_duration_minutes: number;
}

export default function ExamEntryPage() {
  const params = useParams();
  const examId = Number(params.examId);
  const { user } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [canStart, setCanStart] = useState(false);
  const [timeUntilUnlock, setTimeUntilUnlock] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        setSettings(data);

        const unlockTime =
          examId === 1 ? data.exam1_unlock_at : data.exam2_unlock_at;
        const now = new Date();
        const unlock = new Date(unlockTime);

        if (now >= unlock) {
          setCanStart(true);
        } else {
          const diff = unlock.getTime() - now.getTime();
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeUntilUnlock(
            `${hours}h ${minutes}m ${seconds}s`
          );
        }
      }
      setLoading(false);
    }
    fetchSettings();

    const interval = setInterval(() => {
      if (settings) {
        const unlockTime =
          examId === 1 ? settings.exam1_unlock_at : settings.exam2_unlock_at;
        const now = new Date();
        const unlock = new Date(unlockTime);
        if (now >= unlock) {
          setCanStart(true);
          clearInterval(interval);
        } else {
          const diff = unlock.getTime() - now.getTime();
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diff % (1000 * 60)) / 1000);
          setTimeUntilUnlock(`${hours}h ${minutes}m ${seconds}s`);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [examId, settings]);

  const examTitle =
    examId === 1 ? "Test-Driven Development" : "Code Debugging";
  const examDesc =
    examId === 1
      ? "Write code from scratch to pass hidden test cases. Prove your ability to write clean, test-driven solutions."
      : "Analyze pre-written buggy code, find logical/syntax errors, and fix them to pass all test cases.";

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary-light border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-12">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 text-gray-400 hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Dashboard
      </Link>

      <div className="bg-surface border border-border rounded-2xl p-8">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-primary-light text-sm font-medium mb-4">
            <Clock size={14} />
            Round {examId}
          </div>
          <h1 className="text-3xl font-bold text-foreground">{examTitle}</h1>
          <p className="text-gray-400 mt-3 max-w-lg mx-auto">{examDesc}</p>
        </div>

        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 rounded-full bg-success" />
            <span className="text-gray-300">Languages: Python, Java, C, C++</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 rounded-full bg-success" />
            <span className="text-gray-300">
              Duration: {examId === 1 ? settings?.exam1_duration_minutes : settings?.exam2_duration_minutes} minutes
            </span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 rounded-full bg-warning" />
            <span className="text-gray-300">Fullscreen mode is mandatory</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-2 h-2 rounded-full bg-danger" />
            <span className="text-gray-300">
              Auto-submit on 2 fullscreen exits or 3 tab switches
            </span>
          </div>
        </div>

        {canStart ? (
          <button
            onClick={() => router.push(`/dashboard/exam/${examId}/live`)}
            className="w-full py-3 bg-primary hover:bg-primary-light text-white rounded-xl font-semibold text-lg transition-colors"
          >
            Start Exam
          </button>
        ) : (
          <div className="text-center">
            <div className="inline-flex items-center gap-2 px-4 py-3 bg-surface-light border border-border rounded-xl">
              <Lock size={18} className="text-gray-400" />
              <span className="text-gray-300">
                Unlocks in <span className="font-mono text-warning">{timeUntilUnlock}</span>
              </span>
            </div>
          </div>
        )}

        <div className="mt-6 p-4 bg-warning/5 border border-warning/20 rounded-xl">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="text-warning mt-0.5 shrink-0" />
            <div className="text-sm text-gray-400">
              <p className="font-medium text-warning mb-1">Important</p>
              <p>
                Once you click &quot;Start Exam&quot;, a {examId === 1 ? settings?.exam1_duration_minutes : settings?.exam2_duration_minutes}-minute countdown begins.
                The exam will auto-submit when the timer reaches zero.
                Make sure you are ready before starting.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
