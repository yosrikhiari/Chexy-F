import React, {useEffect, useRef, useState} from "react";
import {GameTimers} from "@/Interfaces/types/chess.ts";
import {Timer} from "lucide-react";
import {cn} from "@/lib/utils.ts";



type SpectateChessTimerProps = {
  timers: GameTimers | null;
  isGameOver: boolean;
  whitePlayerName?: string;
  blackPlayerName?: string;
};

const SpectateChessTimer: React.FC<SpectateChessTimerProps> = ({
  timers,
  isGameOver,
  whitePlayerName = "White",
  blackPlayerName = "Black"
}) => {
  const rafRef = useRef<number | null>(null);
  const isGameOverRef = useRef(isGameOver);

  // Baseline snapshot of last server timers and the moment we received them
  const baselineRef = useRef<{
    white: number;
    black: number;
    whiteActive: boolean;
    blackActive: boolean;
    atMs: number; // client receive time; if serverTimeMs exists, we adjust
    serverAtMs?: number; // server timestamp for payload
  } | null>(null);

  // Smoothly updated display values
  const [displayWhite, setDisplayWhite] = useState<number>(timers?.white?.timeLeft ?? 0);
  const [displayBlack, setDisplayBlack] = useState<number>(timers?.black?.timeLeft ?? 0);


  useEffect(() => {
    isGameOverRef.current = isGameOver
  }, [isGameOver]);

  // Update baseline whenever server timers change
  useEffect(() => {
    if (!timers || !timers.white || !timers.black) return;

    const now = performance.now();
    const prev = baselineRef.current;
    const incoming = {
      white: timers.white.timeLeft,
      black: timers.black.timeLeft,
      whiteActive: !!timers.white.active,
      blackActive: !!timers.black.active,
      atMs: now,
      serverAtMs: timers.serverTimeMs,
    };

    if (!prev) {
      baselineRef.current = incoming;
      setDisplayWhite(incoming.white);
      setDisplayBlack(incoming.black);
      return;
    }

    // Compute current derived values from previous baseline
    // Prefer server timestamp if present to derive elapsed
    const baseAt = prev.serverAtMs ?? prev.atMs;
    const elapsed = Math.max(0, Math.floor((now - baseAt) / 1000));
    const prevDerivedWhite = prev.whiteActive ? Math.max(0, prev.white - elapsed) : prev.white;
    const prevDerivedBlack = prev.blackActive ? Math.max(0, prev.black - elapsed) : prev.black;

    const activeUnchanged = prev.whiteActive === incoming.whiteActive && prev.blackActive === incoming.blackActive;

    // Tolerance for drift before hard resync
    const DRIFT_TOLERANCE = 2; // seconds

    // Prepare new baseline while minimizing visual snapping
    let nextBaseline = { ...incoming };

    if (activeUnchanged) {
      if (incoming.whiteActive) {
        const drift = Math.abs(incoming.white - prevDerivedWhite);
        if (drift <= DRIFT_TOLERANCE) {
          // Keep previous baseline for active side to avoid step snaps
          nextBaseline.white = prev.white;
          nextBaseline.atMs = prev.atMs; // preserve elapsed reference
          nextBaseline.serverAtMs = prev.serverAtMs;
        }
      } else {
        // White inactive: pin to incoming value (no local countdown)
        nextBaseline.white = incoming.white;
      }

      if (incoming.blackActive) {
        const drift = Math.abs(incoming.black - prevDerivedBlack);
        if (drift <= DRIFT_TOLERANCE) {
          nextBaseline.black = prev.black;
          nextBaseline.atMs = prev.atMs;
          nextBaseline.serverAtMs = prev.serverAtMs;
        }
      } else {
        nextBaseline.black = incoming.black;
      }
    }

    baselineRef.current = nextBaseline;

    // Immediately reflect for inactive sides only; active side stays continuous
    if (!nextBaseline.whiteActive) setDisplayWhite(nextBaseline.white);
    if (!nextBaseline.blackActive) setDisplayBlack(nextBaseline.black);
  }, [timers?.white?.timeLeft, timers?.black?.timeLeft, timers?.white?.active, timers?.black?.active]);

  // Smooth countdown using rAF derived from baseline
  useEffect(() => {
    const tick = () => {
      if (isGameOverRef.current) {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        return;
      }

      const b = baselineRef.current;
      if (b) {
        const elapsed = Math.max(0, Math.floor((performance.now() - b.atMs) / 1000));

        if (b.whiteActive) {
          const next = Math.max(0, b.white - elapsed);
          setDisplayWhite(prev => (prev !== next ? next : prev));
        } else {
          // Keep in sync with baseline for inactive side
          setDisplayWhite(prev => (prev !== b.white ? b.white : prev));
        }

        if (b.blackActive) {
          const next = Math.max(0, b.black - elapsed);
          setDisplayBlack(prev => (prev !== next ? next : prev));
        } else {
          setDisplayBlack(prev => (prev !== b.black ? b.black : prev));
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    // Start rAF loop
    if (!rafRef.current) {
      rafRef.current = requestAnimationFrame(tick);
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [timers]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secondsRemaining = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secondsRemaining.toString().padStart(2, '0')}`;
  }

  if (!timers || !timers.white || !timers.black) {
    return (
      <div className="text-yellow-600 text-center p-2 bg-yellow-50 rounded-md">
        <div>Loading timer data...</div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-2')}>
      <div className={cn('grid grid-cols-2 gap-2')}>
        <div
          className={cn(
            'flex items-center gap-2 rounded-md p-2',
            timers.white.active && !isGameOver ? 'bg-primary/10 animate-pulse' : 'bg-muted/30',
            displayWhite < 30 && timers.white.active && !isGameOver ? 'text-destructive font-bold' : '',
            displayWhite === 0 ? 'bg-red-100 border-2 border-red-500' : ''
          )}
        >
          <Timer className={cn('h-5 w-5', timers.white.active && !isGameOver ? 'animate-spin' : '')} />
          <div className={cn('text-sm sm:text-base font-medium', displayWhite === 0 ? 'text-red-600 font-bold' : '')}>
            {formatTime(displayWhite)}
          </div>
          <div className="text-xs text-muted-foreground">{whitePlayerName} (white)</div>
          {displayWhite === 0 && (
            <div className="text-xs text-red-600 font-bold">TIME OUT</div>
          )}
        </div>

        <div
          className={cn(
            'flex items-center gap-2 rounded-md p-2',
            timers.black.active && !isGameOver ? 'bg-primary/10 animate-pulse' : 'bg-muted/30',
            displayBlack < 30 && timers.black.active && !isGameOver ? 'text-destructive font-bold' : '',
            displayBlack === 0 ? 'bg-red-100 border-2 border-red-500' : ''
          )}
        >
          <Timer className={cn('h-5 w-5', timers.black.active && !isGameOver ? 'animate-spin' : '')} />
          <div className={cn('text-sm sm:text-base font-medium', displayBlack === 0 ? 'text-red-600 font-bold' : '')}>
            {formatTime(displayBlack)}
          </div>
          <div className="text-xs text-muted-foreground">{blackPlayerName} (black)</div>
          {displayBlack === 0 && (
            <div className="text-xs text-red-600 font-bold">TIME OUT</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpectateChessTimer;
