import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils.ts';
import { Timer } from 'lucide-react';
import { ChessTimerProps } from '@/Interfaces/ChessTimerProps.ts';
import { GameResult, GameTimers, PieceColor } from '@/Interfaces/types/chess.ts';
import { gameSessionService } from "@/services/GameSessionService.ts";
import { gameHistoryService } from "@/services/GameHistoryService.ts";
import { webSocketService } from '@/services/WebSocketService.ts';
import { toast } from "@/components/ui/use-toast.tsx";

const ChessTimer: React.FC<ChessTimerProps> = ({
                                                 timers,
                                                 setTimers,
                                                 currentPlayer,
                                                 isGameOver,
                                                 onTimeout,
                                                 gameId,
                                                 playerId,
                                                 onError,
                                                 isSpectateMode = false,
                                               }) => {
  const [localError, setLocalError] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<string | null>(null);
  const [whitePlayerName, setWhitePlayerName] = useState<string>('White');
  const [blackPlayerName, setBlackPlayerName] = useState<string>('Black');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [hasTimedOut, setHasTimedOut] = useState(false);

  // Use refs to track the current values for cleanup
  const gameIdRef = useRef(gameId);
  const isGameOverRef = useRef(isGameOver);
  const hasTimedOutRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    gameIdRef.current = gameId;
    isGameOverRef.current = isGameOver;
    hasTimedOutRef.current = hasTimedOut;
  }, [gameId, isGameOver, hasTimedOut]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secondsRemaining = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secondsRemaining.toString().padStart(2, '0')}`;
  };

  const handleWebSocketError = (error: string) => {
    console.error('WebSocket error:', error);
    setLocalError(error);
    setConnectionStatus('disconnected');
    onError?.(error);
  };

  // In ChessTimer.tsx, update the handleTimerUpdate function:
  const handleTimerUpdate = (updatedTimers: GameTimers) => {
    console.log('[TIMER] Received timer update:', updatedTimers);

    // Only update if the game is still active and hasn't timed out
    if (!isGameOverRef.current && !hasTimedOutRef.current) {
      setTimers(updatedTimers);
      setConnectionStatus('connected');

      // Check for timeout conditions
      if (updatedTimers.white.timeLeft <= 0 && updatedTimers.white.active) {
        handleTimeoutInternal('white');
      } else if (updatedTimers.black.timeLeft <= 0 && updatedTimers.black.active) {
        handleTimeoutInternal('black');
      }

      // Clear any previous errors when receiving updates
      if (localError) {
        setLocalError(null);
      }
    } else {
      // Game is over, disconnect WebSocket to stop further updates
      console.log('[TIMER] Game is over, disconnecting WebSocket');
      webSocketService.disconnect();
    }
  };

// Also update the local timer countdown effect to properly check game state:
  useEffect(() => {
    // Stop timer if game is over
    if (isGameOver || hasTimedOut || !timers) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Disconnect WebSocket when game ends
      if (isGameOver) {
        webSocketService.disconnect();
      }
      return;
    }

    // Rest of the timer logic...
  }, [timers?.white.active, timers?.black.active, isGameOver, hasTimedOut]);

  const handleTimeoutInternal = async (color: PieceColor) => {
    if (hasTimedOutRef.current || isGameOverRef.current) {
      console.log(`[TIMEOUT] ${color} player timed out - already handled, ignoring`);
      return; // Prevent multiple timeout handling
    }

    console.log(`[TIMEOUT] ${color} player timed out - processing timeout event`);
    setHasTimedOut(true);
    hasTimedOutRef.current = true;

    // Stop the timer immediately
    setTimers(prev => prev ? {
      ...prev,
      white: { ...prev.white, active: false, timeLeft: Math.max(0, prev.white.timeLeft) },
      black: { ...prev.black, active: false, timeLeft: Math.max(0, prev.black.timeLeft) }
    } : prev);

    if (!gameId || !playerId) {
      const errorMsg = "Game ID or Player ID missing";
      setLocalError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    try {
      const session = await gameSessionService.getGameSession(gameId);
      const winner = color === "white" ? "black" : "white";
      let winnerId: string;
      let winnerName: string;

      // Determine winner details - Fixed to use proper player object properties
      if (winner === "white") {
        winnerId = session.whitePlayer?.userId || "";
        winnerName = session.whitePlayer?.username || whitePlayerName;
      } else {
        const blackPlayer = session.blackPlayer;
        winnerId = blackPlayer?.userId || "BOT";
        winnerName = blackPlayer?.username || blackPlayerName;
      }

      // Handle bot games
      if (gameMode === "CLASSIC_SINGLE_PLAYER") {
        if (winner === "black") {
          winnerId = "BOT";
          winnerName = "Bot";
        }
      }

      const gameResult: GameResult = {
        winner,
        winnerName,
        pointsAwarded: session.isRankedMatch ? 15 : 0, // Points for timeout victory
        gameEndReason: "timeout",
        gameid: gameId,
        winnerid: winnerId,
      };

      // Show timeout notification
      toast({
        title: "Time's Up!",
        description: `${color === "white" ? whitePlayerName : blackPlayerName} ran out of time. ${winnerName} wins!`,
        variant: "default",
      });

      // Trigger the timeout callback to parent component
      console.log("[TIMEOUT] Calling parent onTimeout handler");
      onTimeout(color);

    } catch (err) {
      const errorMsg = `Failed to handle timeout: ${(err as Error).message}`;
      setLocalError(errorMsg);
      onError?.(errorMsg);
      console.error(errorMsg);
    }
  };

  // Local timer countdown for backup (in case WebSocket fails)
  useEffect(() => {
    if (isGameOver || hasTimedOut || !timers) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Clear any existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Start local countdown as backup
    intervalRef.current = setInterval(() => {
      if (isGameOverRef.current || hasTimedOutRef.current) {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }

      setTimers(prev => {
        if (!prev) return prev;

        const newTimers = { ...prev };

        // Countdown for active player
        if (prev.white.active && prev.white.timeLeft > 0) {
          newTimers.white = {
            ...prev.white,
            timeLeft: Math.max(0, prev.white.timeLeft - 1)
          };

          // Check if white timed out
          if (newTimers.white.timeLeft === 0) {
            setTimeout(() => handleTimeoutInternal('white'), 0);
          }
        }

        if (prev.black.active && prev.black.timeLeft > 0) {
          newTimers.black = {
            ...prev.black,
            timeLeft: Math.max(0, prev.black.timeLeft - 1)
          };

          // Check if black timed out
          if (newTimers.black.timeLeft === 0) {
            setTimeout(() => handleTimeoutInternal('black'), 0);
          }
        }

        return newTimers;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [timers?.white.active, timers?.black.active, isGameOver, hasTimedOut]);

  useEffect(() => {
    if (!gameId || isGameOver) {
      return;
    }

    let mounted = true;
    if (!isSpectateMode) {
      setConnectionStatus('connecting');
    } else {
      setConnectionStatus('connected');
    }

    const fetchGameSession = async () => {
      try {
        const session = await gameSessionService.getGameSession(gameId);

        if (!mounted) return;

        setGameMode(session.gameMode);
        setWhitePlayerName(session.whitePlayer?.username || 'White');
        const blackPlayer = session.blackPlayer;
        setBlackPlayerName(blackPlayer?.username || 'Bot');

        // Initialize timers from session if not already set
        if (
          session.timers?.white?.timeLeft != null &&
          session.timers?.black?.timeLeft != null &&
          session.timers?.defaultTime != null &&
          (!timers?.white?.timeLeft || !timers?.black?.timeLeft)
        ) {
          setTimers({
            white: {
              timeLeft: session.timers.white.timeLeft,
              active: session.gameState.currentTurn.toLowerCase() === "white",
            },
            black: {
              timeLeft: session.timers.black.timeLeft,
              active: session.gameState.currentTurn.toLowerCase() === "black",
            },
            defaultTime: session.timers.defaultTime,
          });
        }

        // Connect to WebSocket for real-time updates if it's not in the spectate mode
        if(!isSpectateMode) {
          webSocketService.connect(
            gameId,
            handleTimerUpdate,
            handleWebSocketError
          );
        }
      } catch (err) {
        if (!mounted) return;

        const errorMsg = `Failed to fetch game session: ${(err as Error).message}`;
        setLocalError(errorMsg);
        setConnectionStatus('disconnected');
        onError?.(errorMsg);
        console.error(errorMsg);
      }
    };

    fetchGameSession();

    // Cleanup function
    return () => {
      mounted = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      // Only disconnect if this is the component that initiated the connection
      if (gameIdRef.current === gameId) {
        webSocketService.disconnect();
      }
    };
  }, [gameId, isGameOver]);

  if (!timers || !timers.white || !timers.black) {
    return (
      <div className="text-yellow-600 text-center p-2 bg-yellow-50 rounded-md">
        <div>Loading timer data...</div>
        {connectionStatus === 'connecting' && !isSpectateMode && (
          <div className="text-xs mt-1">Connecting to real-time updates...</div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2')}>
      {/* Connection status indicator */}
      {connectionStatus !== 'connected' && !isGameOver && !isSpectateMode && (
        <div className={cn(
          'text-xs text-center py-1 px-2 rounded text-white',
          connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
        )}>
          {connectionStatus === 'connecting' ? 'Connecting to live updates...' : 'Connection lost - timers may not update'}
        </div>
      )}

      <div className={cn('grid grid-cols-2 gap-2', localError && 'border-2 border-red-500 rounded-md')}>
        <div
          className={cn(
            'flex items-center gap-2 rounded-md p-2',
            timers.white.active && !isGameOver && !hasTimedOut ? 'bg-primary/10 animate-pulse' : 'bg-muted/30',
            timers.white.timeLeft < 30 && timers.white.active && !isGameOver ? 'text-destructive font-bold' : '',
            timers.white.timeLeft === 0 ? 'bg-red-100 border-2 border-red-500' : ''
          )}
        >
          <Timer className={cn(
            'h-5 w-5',
            timers.white.active && !isGameOver && !hasTimedOut ? 'animate-spin' : ''
          )} />
          <div className={cn(
            'text-sm sm:text-base font-medium',
            timers.white.timeLeft === 0 ? 'text-red-600 font-bold' : ''
          )}>
            {formatTime(timers.white.timeLeft)}
          </div>
          <div className="text-xs text-muted-foreground">{whitePlayerName} (white)</div>
          {timers.white.timeLeft === 0 && (
            <div className="text-xs text-red-600 font-bold">TIME OUT</div>
          )}
        </div>

        <div
          className={cn(
            'flex items-center gap-2 rounded-md p-2',
            timers.black.active && !isGameOver && !hasTimedOut ? 'bg-primary/10 animate-pulse' : 'bg-muted/30',
            timers.black.timeLeft < 30 && timers.black.active && !isGameOver ? 'text-destructive font-bold' : '',
            timers.black.timeLeft === 0 ? 'bg-red-100 border-2 border-red-500' : ''
          )}
        >
          <Timer className={cn(
            'h-5 w-5',
            timers.black.active && !isGameOver && !hasTimedOut ? 'animate-spin' : ''
          )} />
          <div className={cn(
            'text-sm sm:text-base font-medium',
            timers.black.timeLeft === 0 ? 'text-red-600 font-bold' : ''
          )}>
            {formatTime(timers.black.timeLeft)}
          </div>
          <div className="text-xs text-muted-foreground">{blackPlayerName} (black)</div>
          {timers.black.timeLeft === 0 && (
            <div className="text-xs text-red-600 font-bold">TIME OUT</div>
          )}
        </div>

        {localError && (
          <div className="col-span-2 text-xs bg-red-500 text-white px-2 py-1 rounded mt-2 text-center">
            {localError}
            <button
              onClick={() => {
                setLocalError(null);
                webSocketService.reconnect();
              }}
              className="ml-2 underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChessTimer;
