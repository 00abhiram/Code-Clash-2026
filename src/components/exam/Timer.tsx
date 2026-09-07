"use client";

import { Clock, AlertTriangle } from "lucide-react";
import { useExamTimer } from "@/hooks/useExamTimer";

interface TimerProps {
  durationMinutes: number;
  startedAt: string;
  onTimeUp: () => void;
  isActive: boolean;
}

export default function Timer({
  durationMinutes,
  startedAt,
  onTimeUp,
  isActive,
}: TimerProps) {
  const { formatted, isWarning, isCritical, progress } = useExamTimer({
    durationMinutes,
    startedAt,
    onTimeUp,
    isActive,
  });

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2 rounded-lg border transition-colors ${
        isCritical
          ? "bg-danger/10 border-danger/30 text-danger"
          : isWarning
          ? "bg-warning/10 border-warning/30 text-warning"
          : "bg-surface border-border text-foreground"
      }`}
    >
      <Clock size={18} />
      <span className="font-mono text-lg font-bold tracking-wider">
        {formatted}
      </span>
      {isCritical && (
        <AlertTriangle size={16} className="animate-pulse" />
      )}
      <div className="w-24 h-1.5 bg-gray-700 rounded-full overflow-hidden ml-2">
        <div
          className={`h-full rounded-full transition-all ${
            isCritical
              ? "bg-danger"
              : isWarning
              ? "bg-warning"
              : "bg-primary-light"
          }`}
          style={{ width: `${progress * 100}%` }}
        />
      </div>
    </div>
  );
}
