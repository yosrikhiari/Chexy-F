import React, { useState, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils.ts';
import { Timer } from 'lucide-react';
import { ChessTimerProps } from '@/Interfaces/ChessTimerProps.ts';
import { GameResult, GameTimers, PieceColor } from '@/Interfaces/types/chess.ts';
import { gameSessionService } from "@/services/GameSessionService.ts";
import { gameHistoryService } from "@/services/GameHistoryService.ts";
import { webSocketService } from '@/services/WebSocketService.ts';

const ChessTimer: React.FC<ChessTimerProps> = ({
                                                 timers,
                                                 setTimers,
                                                 currentPlayer,
                                                 isGameOver,
                                                 onTimeout,
                                                 gameId,
                                                 playerId,
                                                 onError,
                                               }) => {
  const [localError, setLocalError] = useState<string | null>(null);
  const [gameMode, setGameMode] = useState<string | null>(null);
  const [whitePlayerName, setWhitePlayerName] = useState<string>('White');
  const [blackPlayerName, setBlackPlayerName] = useState<string>('Black');
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  // Use refs to track the current values for cleanup
  const gameIdRef = useRef(gameId);
  const isGameOverRef = useRef(isGameOver);

  useEffect(() => {
    gameIdRef.current = gameId;
    isGameOverRef.current = isGameOver;
  }, [gameId, isGameOver]);

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

  const handleTimerUpdate = (updatedTimers: GameTimers) => {
    // Only update if the game is still active
    if (!isGameOverRef.current) {
      setTimers(updatedTimers);
      setConnectionStatus('connected');
      // Clear any previous errors when receiving updates
      if (localError) {
        setLocalError(null);
      }
    }
  };

  useEffect(() => {
    if (!gameId || isGameOver) {
      return;
    }

    let mounted = true;
    setConnectionStatus('connecting');

    const fetchGameSession = async () => {
      try {
        const session = await gameSessionService.getGameSession(gameId);

        if (!mounted) return;

        setGameMode(session.gameMode);
        setWhitePlayerName(session.whitePlayer?.username || 'White');
        setBlackPlayerName(session.blackPlayer?.username || 'Bot');

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

        // Connect to WebSocket for real-time updates
        webSocketService.connect(
          gameId,
          handleTimerUpdate,
          handleWebSocketError
        );

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
      // Only disconnect if this is the component that initiated the connection
      if (gameIdRef.current === gameId) {
        webSocketService.disconnect();
      }
    };
  }, [gameId, isGameOver]); // Remove other dependencies to prevent unnecessary reconnections

  const handleTimeout = async (color: PieceColor) => {
    if (!gameId || !playerId) {
      const errorMsg = "Game ID or Player ID missing";
      setLocalError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    try {
      const session = await gameSessionService.getGameSession(gameId);
      let winnerId: string | null = color === "white" ? session.blackPlayer?.userId : session.whitePlayer?.userId;

      if (gameMode === "CLASSIC_SINGLE_PLAYER" && color === "white") {
        winnerId = "BOT";
      }

      const gameResult: GameResult = {
        winner: color === "white" ? "black" : "white",
        winnerName:
          color === "white"
            ? (session.blackPlayer?.username || "Bot")
            : (session.whitePlayer?.username || "White"),
        pointsAwarded: session.isRankedMatch ? 100 : 50,
        gameEndReason: "timeout",
        gameid: gameId,
        winnerid: winnerId || "",
      };

      if (session.status === "ACTIVE") {
        await gameSessionService.endGame(gameId, winnerId || null, false);
        if (session.gameHistoryId) {
          await gameHistoryService.completeGameHistory(session.gameHistoryId, gameResult);
        }
      }

      onTimeout(color);
    } catch (err) {
      const errorMsg = `Failed to handle timeout: ${(err as Error).message}`;
      setLocalError(errorMsg);
      onError?.(errorMsg);
      console.error(errorMsg);
    }
  };

  if (!timers || !timers.white || !timers.black) {
    return (
      <div className="text-yellow-600 text-center p-2 bg-yellow-50 rounded-md">
        <div>Loading timer data...</div>
        {connectionStatus === 'connecting' && (
          <div className="text-xs mt-1">Connecting to real-time updates...</div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-2')}>
      {/* Connection status indicator */}
      {connectionStatus !== 'connected' && !isGameOver && (
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
            timers.white.active && !isGameOver ? 'bg-primary/10 animate-pulse' : 'bg-muted/30',
            timers.white.timeLeft < 30 && timers.white.active && !isGameOver ? 'text-destructive font-bold' : ''
          )}
        >
          <Timer className={cn('h-5 w-5', timers.white.active && !isGameOver ? 'animate-spin' : '')} />
          <div className="text-sm sm:text-base font-medium">{formatTime(timers.white.timeLeft)}</div>
          <div className="text-xs text-muted-foreground">{whitePlayerName} (white)</div>
        </div>

        <div
          className={cn(
            'flex items-center gap-2 rounded-md p-2',
            timers.black.active && !isGameOver ? 'bg-primary/10 animate-pulse' : 'bg-muted/30',
            timers.black.timeLeft < 30 && timers.black.active && !isGameOver ? 'text-destructive font-bold' : ''
          )}
        >
          <Timer className={cn('h-5 w-5', timers.black.active && !isGameOver ? 'animate-spin' : '')} />
          <div className="text-sm sm:text-base font-medium">{formatTime(timers.black.timeLeft)}</div>
          <div className="text-xs text-muted-foreground">{blackPlayerName} (black)</div>
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
