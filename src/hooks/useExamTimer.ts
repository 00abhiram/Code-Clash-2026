"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseExamTimerProps {
  durationMinutes: number;
  startedAt: string;
  onTimeUp: () => void;
  isActive: boolean;
}

export function useExamTimer({
  durationMinutes,
  startedAt,
  onTimeUp,
  isActive,
}: UseExamTimerProps) {
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isExpired, setIsExpired] = useState(false);
  const onTimeUpRef = useRef(onTimeUp);
  const hasCalledTimeUp = useRef(false);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  useEffect(() => {
    if (!isActive || !startedAt) return;

    const start = new Date(startedAt).getTime();
    const end = start + durationMinutes * 60 * 1000;

    const tick = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((end - now) / 1000));
      setTimeRemaining(remaining);

      if (remaining <= 0 && !hasCalledTimeUp.current) {
        setIsExpired(true);
        hasCalledTimeUp.current = true;
        onTimeUpRef.current();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
  }, [durationMinutes, startedAt, isActive]);

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  const progress = timeRemaining / (durationMinutes * 60);
  const isWarning = timeRemaining <= 300 && timeRemaining > 0;
  const isCritical = timeRemaining <= 60 && timeRemaining > 0;

  return {
    timeRemaining,
    minutes,
    seconds,
    progress,
    isExpired,
    isWarning,
    isCritical,
    formatted: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
  };
}
