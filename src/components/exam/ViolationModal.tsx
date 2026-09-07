"use client";

import { AlertTriangle } from "lucide-react";

interface ViolationModalProps {
  show: boolean;
  message: string;
  violationType: string;
  remainingCount: number;
  onDismiss: () => void;
}

const VIOLATION_LABELS: Record<string, string> = {
  fullscreen_exit: "Fullscreen Exit",
  tab_switch: "Tab Switch",
  shortcut_attempt: "Shortcut Attempt",
  background_limit: "Background Time",
  other: "Other",
};

export default function ViolationModal({
  show,
  message,
  violationType,
  remainingCount,
  onDismiss,
}: ViolationModalProps) {
  if (!show) return null;

  const isAutoSubmit =
    message.toLowerCase().startsWith("auto-submitting");
  const label = VIOLATION_LABELS[violationType] || violationType;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-surface border border-danger/30 rounded-2xl p-6 max-w-md mx-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-danger/10 rounded-full flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-danger" />
          </div>
          <h3 className="text-lg font-bold text-foreground">
            {isAutoSubmit ? "Auto-Submit Triggered" : "Violation Detected"}
          </h3>
        </div>
        <div className="mb-2">
          <span className="inline-block px-2 py-0.5 text-xs font-medium bg-danger/10 text-danger rounded">
            {label}
          </span>
          {!isAutoSubmit && remainingCount > 0 && (
            <span className="ml-2 text-xs text-gray-400">
              {remainingCount} remaining before auto-submit
            </span>
          )}
        </div>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex justify-end">
          <button
            onClick={onDismiss}
            className="px-4 py-2 bg-surface-light border border-border rounded-lg text-foreground hover:bg-border transition-colors text-sm font-medium"
          >
            Understood
          </button>
        </div>
      </div>
    </div>
  );
}
