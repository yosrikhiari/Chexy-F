import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Eye, EyeOff, Users, MessageSquare, Clock, Trophy } from 'lucide-react';
import ChessBoardPvP from '@/components/InterfacesService/ChessBoardPvP';
import PlayerInfo from '@/components/InterfacesService/PlayerInfo';
import { GameSession } from '@/Interfaces/types/GameSession';
import { GameResult, GameState, GameTimers, PieceColor, PlayerStats } from '@/Interfaces/types/chess';
import { gameSessionService } from '@/services/GameSessionService';
import { authService } from '@/services/AuthService';
import { User } from '@/Interfaces/user/User';
import { useWebSocket } from '@/WebSocket/WebSocketContext';
import { userService } from '@/services/UserService';
import {JwtService} from "@/services/JwtService.ts";
import SpectatorChat from "@/components/InterfacesService/SpectatorChat.tsx";
import SpectateChessTimer from "@/components/InterfacesService/SpectateChessTimer.tsx";

const SpectatePage: React.FC = () => {
  const [isDelayedLoading, setIsDelayedLoading] = useState(false);
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { client: stompClient, isConnected } = useWebSocket();

  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [delayedGameSession, setDelayedGameSession] = useState<GameSession | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [timers, setTimers] = useState<GameTimers | null>(null);
  const [playerStats, setPlayerStats] = useState<{
    white: PlayerStats;
    black: PlayerStats;
  } | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [spectateAllowed, setSpectateAllowed] = useState(false);


  const [isLoading, setIsLoading] = useState(true);
  const [isSpectating, setIsSpectating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spectatorCount, setSpectatorCount] = useState(0);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [lastMoveTime, setLastMoveTime] = useState<Date | null>(null);

  const gameStateRef = useRef<GameState | null>(null);
  const timersRef = useRef<GameTimers | null>(null);
  // Coalesce incoming WS messages to avoid flip-flop
  const pendingGameStateRef = useRef<GameState | null>(null);
  const pendingTimerRef = useRef<GameTimers | null>(null);
  const processTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const scheduleProcessPendingUpdates = () => {
    if (processTimeoutRef.current) {
      clearTimeout(processTimeoutRef.current);
    }
    // Small delay to let both messages arrive, then process in order
    processTimeoutRef.current = setTimeout(() => {
      // Apply game-state first
      if (pendingGameStateRef.current) {
        const gs = pendingGameStateRef.current;
        setGameState(gs);
        gameStateRef.current = gs;
        setLastMoveTime(new Date());
        pendingGameStateRef.current = null;
      }

      // Then apply timer normalized against delayed turn
      if (pendingTimerRef.current) {
        const timerUpdate = pendingTimerRef.current;
        const delayedTurn = gameStateRef.current?.currentTurn?.toLowerCase();
        const shouldWhiteBeActive = delayedTurn === 'white';
        const shouldBlackBeActive = delayedTurn === 'black';

        const normalizedTimers: GameTimers = {
          white: {
            timeLeft: timerUpdate.white?.timeLeft ?? timersRef.current?.white.timeLeft ?? 0,
            active: delayedTurn ? shouldWhiteBeActive : (timerUpdate.white?.active ?? timersRef.current?.white.active ?? false),
          },
          black: {
            timeLeft: timerUpdate.black?.timeLeft ?? timersRef.current?.black.timeLeft ?? 0,
            active: delayedTurn ? shouldBlackBeActive : (timerUpdate.black?.active ?? timersRef.current?.black.active ?? false),
          },
          defaultTime: timerUpdate.defaultTime ?? timersRef.current?.defaultTime ?? 0,
          serverTimeMs: (timerUpdate as any).serverTimeMs,
        };

        setTimers(normalizedTimers);
        timersRef.current = normalizedTimers;
        pendingTimerRef.current = null;
      }
    }, 30);
  };

  useEffect(() => {
    const initializeSpectate = async () => {
      if (!gameId) {
        setError('No game ID provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setConnectionStatus('connecting');

        // Get current user
        const user = await userService.getCurrentUser(JwtService.getKeycloakId());
        setCurrentUser(user);

        // Get the original game session
        const session = await gameSessionService.getGameSession(gameId);
        setGameSession(session);

        // Check if spectators are allowed
        if (!session.allowSpectators) {
          setError('This game does not allow spectators');
          setIsLoading(false);
          return;
        }

        // Check spectate availability
        const availability = await gameSessionService.getSpectateAvailability(gameId);

        if (!availability.allowed) {
          // Set countdown and wait
          setSecondsRemaining(availability.secondsRemaining);
          setIsLoading(false);
          return;
        }

        // Spectating is allowed, proceed with normal flow
        await proceedWithSpectating(gameId, user, session);

      } catch (error) {
        console.error('Failed to initialize spectate:', error);
        setError('Failed to join spectate mode. The game might not allow spectators.');
        toast({
          title: "Failed to Spectate",
          description: "Could not join spectate mode.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    const proceedWithSpectating = async (gameId: string, user: any, session: any) => {
      // Try to get delayed session (for spectators)
      let activeSession: GameSession | null = null;
      try {
        setIsDelayedLoading(true);
        const delayedSession = await gameSessionService.getGameSession(`SpecSession-${gameId}`);
        if (delayedSession) {
          activeSession = delayedSession;
          setDelayedGameSession(delayedSession);
        }
      } catch (error) {
        console.log('No delayed session available yet; waiting for delayed stream');
      } finally {
        setIsDelayedLoading(false);
      }
      const { allowed, secondsRemaining } = await gameSessionService.getSpectateAvailability(gameId);
      setSpectateAllowed(allowed);
      setSecondsRemaining(allowed ? 0 : secondsRemaining);
      if (!allowed) { setIsLoading(false); return; }
      // Join spectate mode
      await gameSessionService.joinSpectate(gameId, user.id);
      setIsSpectating(true);

      // Set up game state
      if (activeSession) {
        setGameState(activeSession.gameState);
        gameStateRef.current = activeSession.gameState;

        const isWhiteTurn = activeSession.gameState.currentTurn?.toLowerCase() === 'white';
        const normalizedTimers = {
          white: {
            timeLeft: activeSession.timers.white.timeLeft,
            active: isWhiteTurn,
          },
          black: {
            timeLeft: activeSession.timers.black.timeLeft,
            active: !isWhiteTurn,
          },
          defaultTime: activeSession.timers.defaultTime,
        };

        setTimers(normalizedTimers);
        timersRef.current = normalizedTimers;
      } else {
        setGameState(null);
        setTimers(null);
      }

      // Set up player stats
      const whitePlayer = (activeSession || session).whitePlayer;
      const blackPlayer = Array.isArray((activeSession || session).blackPlayer)
        ? (activeSession || session).blackPlayer[0]
        : (activeSession || session).blackPlayer;

      if ("currentStats" in blackPlayer) {
        setPlayerStats({
          white: {
            playerId: whitePlayer?.userId || '',
            name: whitePlayer?.username || 'White Player',
            points: whitePlayer?.currentStats?.points || 0
          },
          black: {
            playerId: blackPlayer?.userId || '',
            name: blackPlayer?.username || 'Black Player',
            points: blackPlayer?.currentStats?.points || 0
          }
        });
      }

      try {
        const spectators = await gameSessionService.getSpectators(gameId);
        setSpectatorCount(spectators.length);
      } catch (error) {
        console.error('Failed to get spectator count:', error);
      }

      setConnectionStatus('connected');
      if ("username" in blackPlayer) {
        toast({
          title: "Joined Spectate Mode",
          description: `Now spectating ${whitePlayer?.username || 'Unknown'} vs ${blackPlayer?.username || 'Unknown'}`,
        });
      }
    };

    initializeSpectate();

    // Cleanup on unmount
    return () => {
      if (gameId && currentUser && isSpectating) {
        gameSessionService.leaveSpectate(gameId, currentUser.id).catch(console.error);
      }
    };
  }, [gameId, navigate, toast]);

  useEffect(() => {
    if (!stompClient || !gameId || !isSpectating ) return;

    const setupWebSocketSubscriptions = () => {
      const delayedGameStateSubscription = stompClient.subscribe(
        `/topic/spectator-game-state/${gameId}`,
        (message : any) => {
          try {
            const gameStateUpdate  = JSON.parse(message.body);
            pendingGameStateRef.current = gameStateUpdate;
            scheduleProcessPendingUpdates();
          }
          catch (error) {
            console.log('Error parsing delayed game state :',error);
          }
        }
      );
      const timerSubscription = stompClient.subscribe(
        `/topic/game/SpecSession-${gameId}/timer`,
        (message: any) => {
          try {
            const timerUpdate = JSON.parse(message.body);
            pendingTimerRef.current = timerUpdate;
            scheduleProcessPendingUpdates();
          } catch (error) {
            console.error('Error parsing timer update:', error);
          }
        }
      );

      const spectatorCountSubscription = stompClient.subscribe(
        `/topic/spectator-count/${gameId}`,
        (message: any) => {
          try {
            const countUpdate = JSON.parse(message.body);
            setSpectatorCount(countUpdate.count);
          } catch (error) {
            console.error('Error parsing spectator count:', error);
          }
        }
      );

      return () =>{
        delayedGameStateSubscription.unsubscribe();
        timerSubscription.unsubscribe();
        spectatorCountSubscription.unsubscribe();
        if (processTimeoutRef.current) {
          clearTimeout(processTimeoutRef.current);
          processTimeoutRef.current = null;
        }
      };
    };
    const cleanup = setupWebSocketSubscriptions();
    setConnectionStatus(isConnected ? 'connected' : 'disconnected');

    return cleanup;
  }, [stompClient, gameId, isSpectating, isConnected]);

  useEffect(() => {
    if (!gameId || !isSpectating) return;

    const refreshDelayedSession = async() => {
      try {
        const delayedSession = await gameSessionService.getGameSession(`SpecSession-${gameId}`);
        if (!isConnected) {
          // Use backend timer actives rather than deriving from turn
          const normalizedTimers = {
            white: {
              timeLeft: delayedSession.timers.white.timeLeft,
              active: delayedSession.timers.white.active,
            },
            black: {
              timeLeft: delayedSession.timers.black.timeLeft,
              active: delayedSession.timers.black.active,
            },
            defaultTime: delayedSession.timers.defaultTime,
          };
          setTimers(normalizedTimers);
          timersRef.current = normalizedTimers;
        }
      }
      catch (error) {
        console.error('Error parsing delayed game state:', error);
      }
    };
    const interval = setInterval(refreshDelayedSession, 3000);
    return () => {clearInterval(interval);};
  }, [gameId, isSpectating, isConnected]);

  const handleLeaveSpectate = async () => {
    if (gameId && currentUser) {
      try {
        await gameSessionService.leaveSpectate(gameId, currentUser.id);
        setIsSpectating(false);
        navigate('/lobby');
        toast({
          title: "Left Spectate Mode",
          description: "You are no longer spectating this game.",
        });
      } catch (error) {
        console.error('Failed to leave spectate:', error);
      }
    }
  };
// Countdown effect
useEffect(() => {
  if (secondsRemaining === null || secondsRemaining <= 0 || spectateAllowed) return;

  const timer = setTimeout(() => {
    setSecondsRemaining(prev => {
      if (prev === null || prev <= 1) {
        if (gameId && currentUser) {
          gameSessionService.joinSpectate(gameId, currentUser.id)
            .then(() => {
              setIsSpectating(true);
              setSecondsRemaining(null);
              // no window.location.reload()
            })
            .catch(async () => {
              const availability = await gameSessionService.getSpectateAvailability(gameId);
              setSecondsRemaining(availability.secondsRemaining);
            });
        }
        return null;
      }
      return prev - 1;
    });
  }, 1000);

  return () => clearTimeout(timer);
}, [secondsRemaining, spectateAllowed, gameId, currentUser]);


  if (isLoading) {
    return (
      <div className="min-h-screen bg-mystical-gradient flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p>Loading spectate mode...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-mystical-gradient flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <p className="text-red-500 mb-4">{error}</p>
            <Button onClick={() => navigate('/lobby')}>
              <ArrowLeft className="h-4 w-4 mr-2"/>
              Back to Lobby
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Countdown screen
  if (secondsRemaining !== null && secondsRemaining > 0 && !spectateAllowed) {
    return (
      <div className="min-h-screen bg-mystical-gradient flex items-center justify-center">
        <Card className="w-[420px]">
          <CardHeader>
            <CardTitle className="text-center">Spectate available soon</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2">
              <Clock className="h-5 w-5" />
              <span>Starting in {secondsRemaining}s</span>
            </div>
            <div className="text-sm text-muted-foreground">
              To prevent live help, spectating is delayed by 2 minutes.
            </div>
            <Button
              onClick={async () => {
                try {
                  const availability = await gameSessionService.getSpectateAvailability(gameId!);
                  setSecondsRemaining(availability.secondsRemaining);
                  setSpectateAllowed(availability.allowed);
                  if (availability.allowed && currentUser) {
                    await gameSessionService.joinSpectate(gameId!, currentUser.id);
                    setIsSpectating(true);
                    setSecondsRemaining(null);
                  }
                } catch {}
              }}
            >
              Refresh
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!gameSession || !gameState || !timers || !playerStats) {
    return (
      <div className="min-h-screen bg-mystical-gradient flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="p-6 text-center">
            <p>Game data not available</p>
            <Button onClick={() => navigate('/lobby')} className="mt-4">
              <ArrowLeft className="h-4 w-4 mr-2"/>
              Back to Lobby
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mystical-gradient">
      <div className="container mx-auto px-4 py-4">
        {/* Enhanced Header */}
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/lobby')}
              className="flex items-center gap-2 hover:bg-primary/10"
            >
              <ArrowLeft className="h-4 w-4"/>
              Back to Lobby
            </Button>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Eye className="h-6 w-6 text-primary" />
                Spectating Game
              </h1>
              <div className="flex items-center gap-4 mt-1">
                <p className="text-sm text-muted-foreground">
                  {playerStats.white.name} vs {playerStats.black.name}
                </p>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    connectionStatus === 'connected' ? 'bg-green-500' :
                      connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-xs text-muted-foreground capitalize">
                    {connectionStatus}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-muted/50 px-3 py-2 rounded-lg">
              <Users className="h-4 w-4" />
              <span className="text-sm font-medium">{spectatorCount} watching</span>
            </div>
            <Button
              variant="outline"
              onClick={handleLeaveSpectate}
              className="flex items-center gap-2"
            >
              <EyeOff className="h-4 w-4" />
              Leave Spectate
            </Button>
          </div>
        </div>

        {/* Game Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 min-h-[70vh]">
          {/* Main Game Area */}
          <div className="lg:col-span-3">
            <div className="flex flex-col gap-6">
              {/* Enhanced Player Info and Timer */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-4">
                  <PlayerInfo
                    name={playerStats.black.name}
                    points={playerStats.black.points}
                    color="black"
                    isCurrentPlayer={gameState.currentTurn === "black"}
                  />
                </Card>
                <Card className="p-4">
                  <div className="text-center">
                    <SpectateChessTimer
                      timers={timers}
                      isGameOver={false}
                      whitePlayerName={playerStats.white.name}
                      blackPlayerName={playerStats.black.name}
                    />
                    {lastMoveTime && (
                      <p className="text-xs text-muted-foreground mt-2">
                        Last move: {lastMoveTime.toLocaleTimeString()}
                      </p>
                    )}
                  </div>
                </Card>
                <Card className="p-4">
                  <PlayerInfo
                    name={playerStats.white.name}
                    points={playerStats.white.points}
                    color="white"
                    isCurrentPlayer={gameState.currentTurn === "white"}
                  />
                </Card>
              </div>

              {/* Enhanced Chess Board */}
              <Card className="p-6">
                <div className="flex justify-center">
                  <ChessBoardPvP
                    gameState={gameState}
                    onMoveMade={() => {
                    }}
                    isSpectateMode={true} onGameEnd={function (result: GameResult): Promise<void> {
                    throw new Error('Function not implemented.');
                  }} onTimeout={function (color: PieceColor): void {
                    throw new Error('Function not implemented.');
                  }}                  />
                </div>
              </Card>

              {/* Game Status Bar */}
              <Card className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="text-sm">Game Mode: {gameSession.gameMode || 'Classic'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Trophy className="h-4 w-4" />
                      <span className="text-sm">
                        {gameSession.isRankedMatch ? 'Ranked Match' : 'Casual Match'}
                      </span>
                    </div>
                  </div>
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    Spectator View
                  </Badge>
                </div>
              </Card>
            </div>
          </div>

          {/* Enhanced Sidebar */}
          <div className="space-y-4">
            <SpectatorChat gameId={gameId!} />
          </div>
        </div>

        {/* Enhanced Spectate Notice */}
        <Card className="mt-6 p-4 bg-primary/5 border-primary/20">
          <div className="flex items-center justify-center gap-2 text-sm text-primary">
            <Eye className="h-4 w-4" />
            <span>You are spectating this game. Moves are delayed by 2 plies to prevent cheating.</span>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default SpectatePage;
