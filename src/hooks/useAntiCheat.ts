"use client";

import { useEffect, useRef, useState, useCallback } from "react";

interface UseAntiCheatProps {
  isEnabled: boolean;
  examSessionId: string;
  onViolation: (type: string, description: string) => void;
  onAutoSubmit: (reason?: string) => void;
  maxFullscreenExits?: number;
  maxBackgroundTimeMs?: number;
  maxViolationCount?: number;
}

export function useAntiCheat({
  isEnabled,
  onViolation,
  onAutoSubmit,
  maxFullscreenExits = 2,
  maxBackgroundTimeMs = 15000,
  maxViolationCount = 5,
}: UseAntiCheatProps) {
  const [showWarning, setShowWarning] = useState(false);
  const [warningMessage, setWarningMessage] = useState("");
  const [violationType, setViolationType] = useState("");
  const [remainingCount, setRemainingCount] = useState(0);
  const onViolationRef = useRef(onViolation);
  const onAutoSubmitRef = useRef(onAutoSubmit);

  // Cumulative background time tracking
  const backgroundTimeRef = useRef(0);
  const backgroundStartRef = useRef<number | null>(null);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasAutoSubmittedRef = useRef(false);

  // Fullscreen exit count tracking
  const fullscreenExitCountRef = useRef(0);

  // Total violation count tracking (all types combined)
  const violationCountRef = useRef(0);

  useEffect(() => {
    onViolationRef.current = onViolation;
    onAutoSubmitRef.current = onAutoSubmit;
  }, [onViolation, onAutoSubmit]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, []);

  // Fullscreen detection — auto-submit after maxFullscreenExits
  useEffect(() => {
    if (!isEnabled) return;

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        fullscreenExitCountRef.current += 1;
        const exitsLeft = maxFullscreenExits - fullscreenExitCountRef.current;

        onViolationRef.current("fullscreen_exit", `Fullscreen exited (exit ${fullscreenExitCountRef.current}/${maxFullscreenExits})`);

        if (fullscreenExitCountRef.current >= maxFullscreenExits && !hasAutoSubmittedRef.current) {
          hasAutoSubmittedRef.current = true;
          setViolationType("fullscreen_exit");
          setRemainingCount(0);
          setWarningMessage(
            `Auto-submitting! You exceeded the fullscreen exit limit (${maxFullscreenExits} exits).`
          );
          setShowWarning(true);
          setTimeout(() => onAutoSubmitRef.current("fullscreen_limit"), 2000);
        } else {
          setViolationType("fullscreen_exit");
          setRemainingCount(exitsLeft);
          setWarningMessage(
            `Warning: Fullscreen exited (${exitsLeft} remaining before auto-submit). Please re-enter fullscreen immediately.`
          );
          setShowWarning(true);
          setTimeout(() => setShowWarning(false), 5000);
        }
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () =>
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, [isEnabled, maxFullscreenExits]);

  // 15-second cumulative background timer
  useEffect(() => {
    if (!isEnabled) return;

    const startBackgroundTimer = () => {
      backgroundStartRef.current = Date.now();
      timerIntervalRef.current = setInterval(() => {
        if (!backgroundStartRef.current) return;
        const elapsed = Date.now() - backgroundStartRef.current;
        const totalElapsed = backgroundTimeRef.current + elapsed;
        const remaining = Math.max(0, maxBackgroundTimeMs - totalElapsed);
        const secondsLeft = Math.ceil(remaining / 1000);

        if (remaining <= 0 && !hasAutoSubmittedRef.current) {
          hasAutoSubmittedRef.current = true;
          if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
          onViolationRef.current("background_limit", "Background time exceeded 15 seconds");
          setViolationType("background_limit");
          setRemainingCount(0);
          setWarningMessage(
            `Auto-submitting! You exceeded the cumulative background time limit.`
          );
          setShowWarning(true);
          setTimeout(() => onAutoSubmitRef.current("background_limit"), 2000);
        } else if (remaining <= 5000 && !hasAutoSubmittedRef.current) {
          setViolationType("background_limit");
          setRemainingCount(secondsLeft);
          setWarningMessage(
            `Warning! Returning to background (${secondsLeft}s remaining before auto-submit).`
          );
          setShowWarning(true);
        }
      }, 250); // Check every 250ms for smooth countdown
    };

    const pauseBackgroundTimer = () => {
      if (backgroundStartRef.current) {
        backgroundTimeRef.current += Date.now() - backgroundStartRef.current;
        backgroundStartRef.current = null;
      }
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };

    const handleVisibilityChange = () => {
      if (hasAutoSubmittedRef.current) return;

      if (document.hidden) {
        // Student left the tab — start accumulating time
        onViolationRef.current("tab_switch", "Tab hidden");
        startBackgroundTimer();
      } else {
        // Student returned — pause accumulation
        pauseBackgroundTimer();
        // Only show warning if they haven't been auto-submitted
        if (!hasAutoSubmittedRef.current) {
          const secondsUsed = Math.ceil(backgroundTimeRef.current / 1000);
          if (secondsUsed > 0) {
            const secondsLeft = Math.ceil(
              Math.max(0, maxBackgroundTimeMs - backgroundTimeRef.current) / 1000
            );
            setViolationType("tab_switch");
            setRemainingCount(secondsLeft);
            setWarningMessage(
              `You returned. ${secondsUsed}s of background time used (${secondsLeft}s remaining).`
            );
            setShowWarning(true);
            setTimeout(() => setShowWarning(false), 5000);
          }
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      pauseBackgroundTimer();
    };
  }, [isEnabled, maxBackgroundTimeMs]);

  // Block shortcuts
  useEffect(() => {
    if (!isEnabled) return;

    const blockedKeys = new Set(["F12"]);
    const blockedCombos = new Set([
      "Control+c",
      "Control+v",
      "Control+x",
      "Control+shift+i",
      "Control+shift+j",
      "Control+u",
      "Meta+c",
      "Meta+v",
      "Meta+x",
    ]);

    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const combo = `${e.ctrlKey || e.metaKey ? "Control" : ""}${e.shiftKey ? "+shift" : ""}+${key}`;

      if (blockedKeys.has(e.key) || blockedCombos.has(combo)) {
        e.preventDefault();
        e.stopPropagation();
        violationCountRef.current += 1;
        onViolationRef.current("shortcut_attempt", `Blocked key: ${e.key}`);

        if (violationCountRef.current >= maxViolationCount && !hasAutoSubmittedRef.current) {
          hasAutoSubmittedRef.current = true;
          setViolationType("shortcut_attempt");
          setRemainingCount(0);
          setWarningMessage(
            `Auto-submitting! You exceeded the violation limit (${maxViolationCount} violations).`
          );
          setShowWarning(true);
          setTimeout(() => onAutoSubmitRef.current("violation_limit"), 2000);
        } else {
          const remaining = maxViolationCount - violationCountRef.current;
          setViolationType("shortcut_attempt");
          setRemainingCount(remaining);
          setWarningMessage(
            `Shortcut blocked. ${remaining} violation${remaining !== 1 ? "s" : ""} remaining before auto-submit.`
          );
          setShowWarning(true);
          setTimeout(() => setShowWarning(false), 5000);
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      violationCountRef.current += 1;
      onViolationRef.current("shortcut_attempt", "Right-click blocked");

      if (violationCountRef.current >= maxViolationCount && !hasAutoSubmittedRef.current) {
        hasAutoSubmittedRef.current = true;
        setViolationType("shortcut_attempt");
        setRemainingCount(0);
        setWarningMessage(
          `Auto-submitting! You exceeded the violation limit (${maxViolationCount} violations).`
        );
        setShowWarning(true);
        setTimeout(() => onAutoSubmitRef.current("violation_limit"), 2000);
      } else {
        const remaining = maxViolationCount - violationCountRef.current;
        setViolationType("shortcut_attempt");
        setRemainingCount(remaining);
        setWarningMessage(
          `Right-click blocked. ${remaining} violation${remaining !== 1 ? "s" : ""} remaining before auto-submit.`
        );
        setShowWarning(true);
        setTimeout(() => setShowWarning(false), 5000);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("contextmenu", handleContextMenu);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("contextmenu", handleContextMenu);
    };
  }, [isEnabled, maxViolationCount]);

  const requestFullscreen = useCallback(async () => {
    if (!isEnabled) return;
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) {
        await el.requestFullscreen();
      }
    } catch (err) {
      console.error("Failed to enter fullscreen:", err);
    }
  }, [isEnabled]);

  return {
    showWarning,
    warningMessage,
    violationType,
    remainingCount,
    dismissWarning: () => setShowWarning(false),
    requestFullscreen,
  };
}
