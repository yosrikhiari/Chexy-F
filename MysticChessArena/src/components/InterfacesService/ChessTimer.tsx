import React, { useEffect, useState } from 'react';
import { GameResult, GameTimers, PieceColor } from '@/Interfaces/types/chess.ts';
import { ChessTimerProps } from '@/Interfaces/ChessTimerProps.ts';
import { cn } from '@/lib/utils.ts';
import { Timer } from 'lucide-react';
import {gameSessionService} from "@/services/GameSessionService.ts";
import {realtimeService} from "@/services/RealtimeService.ts";
import {gameHistoryService} from "@/services/GameHistoryService.ts";


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

  // Fetch initial game session data to get timers, game mode, and player names
  useEffect(() => {
    if (!gameId || isGameOver) return;

    const fetchGameSession = async () => {
      try {
        const session = await gameSessionService.getGameSession(gameId);
        setGameMode(session.gameMode);
        setWhitePlayerName(session.whitePlayer.username);
        setBlackPlayerName(session.blackPlayer.username);

        // Only update timers if not provided via props
        if (!timers.white.timeLeft || !timers.black.timeLeft) {
          setTimers({
            white: { timeLeft: session.timers.white.timeLeft, active: session.timers.white.active },
            black: { timeLeft: session.timers.black.timeLeft, active: session.timers.black.active },
            defaultTime: session.timers.defaultTime,
          });
        }
      } catch (err) {
        const errorMsg = `Failed to fetch game session: ${err.message}`;
        setLocalError(errorMsg);
        onError?.(errorMsg);
        console.error(errorMsg);
      }
    };

    fetchGameSession();
  }, [gameId, isGameOver, setTimers, onError]);

  // Timer countdown logic
  useEffect(() => {
    if (isGameOver || !gameId || gameMode === 'SINGLE_PLAYER_RPG') return;

    const timerInterval = setInterval(() => {
      setTimers((prev: GameTimers) => {
        if (prev[currentPlayer].active && prev[currentPlayer].timeLeft > 0) {
          const updatedTimers = {
            ...prev,
            [currentPlayer]: {
              ...prev[currentPlayer],
              timeLeft: prev[currentPlayer].timeLeft - 1,
            },
          };

          // Handle timeout
          if (updatedTimers[currentPlayer].timeLeft === 0) {
            handleTimeout(currentPlayer);
          }

          return updatedTimers;
        }
        return prev;
      });
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [currentPlayer, isGameOver, setTimers, gameId, gameMode]);

  // WebSocket for real-time timer updates
  useEffect(() => {
    if (!gameId || isGameOver || gameMode === 'SINGLE_PLAYER_RPG') return;

    const ws = new WebSocket(`ws://${import.meta.env.VITE_API_BASE_URL}/realtime/${gameId}`);
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'TIMER_UPDATE') {
          setTimers(data.timers);
          console.log('Received timer update via WebSocket');
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    };
    ws.onerror = () => {
      const errorMsg = 'WebSocket connection failed';
      setLocalError(errorMsg);
      onError?.(errorMsg);
      console.error(errorMsg);
    };

    return () => ws.close();
  }, [gameId, isGameOver, gameMode, setTimers, onError]);

  // Send timer updates to opponent via RealtimeService
  const sendTimerUpdate = async () => {
    try {
      const opponentId = await getOpponentId();
      if (opponentId) {
        await realtimeService.sendToPlayer(opponentId, {
          type: 'TIMER_UPDATE',
          timers,
          gameId,
        });
        console.log('Timer synced with opponent');
      }
    } catch (err) {
      const errorMsg = `Failed to send timer update: ${err.message}`;
      setLocalError(errorMsg);
      onError?.(errorMsg);
      console.error(errorMsg);
    }
  };

  // Get opponent player ID from game session
  const getOpponentId = async (): Promise<string | null> => {
    try {
      const session = await gameSessionService.getGameSession(gameId!);
      return session.whitePlayer.userId === playerId
        ? session.blackPlayer.userId
        : session.whitePlayer.userId;
    } catch (err) {
      console.error('Failed to get opponent ID:', err);
      return null;
    }
  };

  // Handle timeout event
  const handleTimeout = async (color: PieceColor) => {
    if (!gameId || !playerId) {
      const errorMsg = 'Game ID or Player ID missing';
      setLocalError(errorMsg);
      onError?.(errorMsg);
      console.error(errorMsg);
      return;
    }

    try {
      // Determine winner (opponent of the timed-out player)
      const session = await gameSessionService.getGameSession(gameId);
      const winnerId =
        color === 'white' ? session.blackPlayer.userId : session.whitePlayer.userId;

      // End the game
      await gameSessionService.endGame(gameId, winnerId);

      // Record game history
      const gameResult: GameResult = {
        winner: color === 'white' ? 'black' : 'white',
        winnerName: winnerId === session.whitePlayer.userId ? session.whitePlayer.username : session.blackPlayer.username,
        pointsAwarded: session.isRankedMatch ? 100 : 50,
        gameEndReason: 'timeout',
        gameid: gameId,
        winnerid: winnerId,
      };

      if (session.gameHistoryId) {
        await gameHistoryService.completeGameHistory(session.gameHistoryId, gameResult);
      }

      // Broadcast timeout event
      await realtimeService.broadcastGameState(gameId);

      // Trigger onTimeout callback
      onTimeout(color);
    } catch (err) {
      const errorMsg = `Failed to handle timeout: ${err.message}`;
      setLocalError(errorMsg);
      onError?.(errorMsg);
      console.error(errorMsg);
    }
  };

  return (
    <div className={cn('grid grid-cols-2 gap-2', localError && 'border-2 border-red-500 rounded-md')}>
      {/* White timer */}
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

      {/* Black timer */}
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

      {/* Error indicator */}
      {localError && (
        <div className="col-span-2 text-xs bg-red-500 text-white px-2 py-1 rounded mt-2 text-center">
          {localError}
        </div>
      )}
    </div>
  );
};

export default ChessTimer;
