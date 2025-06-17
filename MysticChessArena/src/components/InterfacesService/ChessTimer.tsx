import React, { useEffect, useState } from 'react';
import { GameResult, GameTimers, PieceColor } from '@/Interfaces/types/chess.ts';
import { ChessTimerProps } from '@/Interfaces/ChessTimerProps.ts';
import { cn } from '@/lib/utils.ts';
import { Timer } from 'lucide-react';
import { gameSessionService } from "@/services/GameSessionService.ts";
import { gameHistoryService } from "@/services/GameHistoryService.ts";

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

  // Format time as mm:ss
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secondsRemaining = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secondsRemaining.toString().padStart(2, '0')}`;
  };

  // Fetch initial game session data
  useEffect(() => {
    if (!gameId || isGameOver) return;

    const fetchGameSession = async () => {
      try {
        const session = await gameSessionService.getGameSession(gameId);
        setGameMode(session.gameMode);
        setWhitePlayerName(session.whitePlayer?.username || 'White');
        setBlackPlayerName(session.blackPlayer?.username || 'Bot');

        // Validate session.timers before updating
        if (
          session.timers?.white?.timeLeft != null &&
          session.timers?.black?.timeLeft != null &&
          session.timers?.defaultTime != null &&
          (!timers?.white?.timeLeft || !timers?.black?.timeLeft)
        ) {
          setTimers({
            white: {
              timeLeft: session.timers.white.timeLeft,
              active: session.timers.white.active ?? false,
            },
            black: {
              timeLeft: session.timers.black.timeLeft,
              active: session.timers.black.active ?? false,
            },
            defaultTime: session.timers.defaultTime,
          });
        } else if (!session.timers) {
          const errorMsg = 'Invalid timer data received from game session';
          setLocalError(errorMsg);
          onError?.(errorMsg);
          console.error(errorMsg);
        }
      } catch (err) {
        const errorMsg = `Failed to fetch game session: ${(err as Error).message}`;
        setLocalError(errorMsg);
        onError?.(errorMsg);
        console.error(errorMsg);
      }
    };

    fetchGameSession();
  }, [gameId, isGameOver, setTimers, onError, timers]);

  // Timer countdown logic
  useEffect(() => {
    if (isGameOver || !gameId || gameMode === 'SINGLE_PLAYER_RPG' || !timers) return;

    const timerInterval = setInterval(() => {
      setTimers((prev: GameTimers) => {
        if (prev && prev[currentPlayer]?.active && prev[currentPlayer]?.timeLeft > 0) {
          const updatedTimers = {
            ...prev,
            [currentPlayer]: {
              ...prev[currentPlayer],
              timeLeft: prev[currentPlayer].timeLeft - 1,
            },
          };

          if (updatedTimers[currentPlayer].timeLeft === 0) {
            handleTimeout(currentPlayer);
          }

          return updatedTimers;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [currentPlayer, isGameOver, setTimers, gameId, gameMode, timers]);

  // Handle timeout event
  const handleTimeout = async (color: PieceColor) => {
    if (!gameId || !playerId) {
      const errorMsg = "Game ID or Player ID missing";
      setLocalError(errorMsg);
      onError?.(errorMsg);
      return;
    }

    try {
      const session = await gameSessionService.getGameSession(gameId);
      const winnerId = color === "white" ? session.blackPlayer?.userId : session.whitePlayer?.userId;

      if (winnerId) {
        await gameSessionService.endGame(gameId, winnerId, false); // Timeout is a win, not a draw
        const gameResult: GameResult = {
          winner: color === "white" ? "black" : "white",
          winnerName: winnerId === session.whitePlayer?.userId ? session.whitePlayer.username : (session.blackPlayer?.username || "Bot"),
          pointsAwarded: session.isRankedMatch ? 100 : 50,
          gameEndReason: "timeout",
          gameid: gameId,
          winnerid: winnerId,
        };

        if (session.gameHistoryId) {
          await gameHistoryService.completeGameHistory(session.gameHistoryId, gameResult);
        }
        onTimeout(color);
      } else {
        throw new Error("Winner ID not found");
      }
    } catch (err) {
      const errorMsg = `Failed to handle timeout: ${(err as Error).message}`;
      setLocalError(errorMsg);
      onError?.(errorMsg);
      console.error(errorMsg);
    }
  };

  // Defensive check for timers
  if (!timers || !timers.white || !timers.black) {
    return (
      <div className="text-red-500 text-center p-2">
        Error: Timer data is not available.
      </div>
    );
  }

  return (
    <div className={cn('grid grid-cols-2 gap-2', localError && 'border-2 border-red-500 rounded-md')}>
      <div
        className={cn(
          'flex items-center gap-2 rounded-md p-2',
          timers.white.active ? 'bg-primary/10 animate-pulse' : 'bg-muted/30',
          timers.white.timeLeft < 30 && timers.white.active ? 'text-destructive font-bold' : ''
        )}
      >
        <Timer className={cn('h-5 w-5', timers.white.active ? 'animate-spin' : '')} />
        <div className="text-sm sm:text-base font-medium">{formatTime(timers.white.timeLeft)}</div>
        <div className="text-xs text-muted-foreground">{whitePlayerName} (white)</div>
      </div>

      <div
        className={cn(
          'flex items-center gap-2 rounded-md p-2',
          timers.black.active ? 'bg-primary/10 animate-pulse' : 'bg-muted/30',
          timers.black.timeLeft < 30 && timers.black.active ? 'text-destructive font-bold' : ''
        )}
      >
        <Timer className={cn('h-5 w-5', timers.black.active ? 'animate-spin' : '')} />
        <div className="text-sm sm:text-base font-medium">{formatTime(timers.black.timeLeft)}</div>
        <div className="text-xs text-muted-foreground">{blackPlayerName} (black)</div>
      </div>

      {localError && (
        <div className="col-span-2 text-xs bg-red-500 text-white px-2 py-1 rounded mt-2 text-center">
          {localError}
        </div>
      )}
    </div>
  );
};

export default ChessTimer;
