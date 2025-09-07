import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import ChessBoard from '@/components/InterfacesService/ChessBoard';
import ChessTimer from '@/components/InterfacesService/ChessTimer';
import PlayerInfo from '@/components/InterfacesService/PlayerInfo';

import { GameSession } from '@/Interfaces/types/GameSession';
import { GameResult, GameState, GameTimers, PieceColor, PlayerStats} from '@/Interfaces/types/chess';
import {gameSessionService} from '@/services/GameSessionService';
import {authService} from '@/services/AuthService';
import {User} from '@/Interfaces/user/User';
import SpectatorChat from "@/components/InterfacesService/SpectatorChat.tsx";
import SpectatorList from "@/components/InterfacesService/SpectatorList.tsx";
import {userService} from "@/services/UserService.ts";
import {JwtService} from "@/services/JwtService.ts";

const SpectatePage: React.FC = () => {
  const {gameId} = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const {toast} = useToast();

  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [delayedGameSession, setDelayedGameSession] = useState<GameSession | null>(null);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [timers, setTimers] = useState<GameTimers | null>(null);
  const [playerStats, setPlayerStats] = useState<{
    white: PlayerStats;
    black: PlayerStats;
  } | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSpectating, setIsSpectating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeSpectate = async () => {
      if (!gameId) {
        setError('No game ID provided');
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);

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

        // Try to get delayed session (for spectators)
        try {
          const delayedSession = await gameSessionService.getGameSession(`SpecSession-${gameId}`);
          setDelayedGameSession(delayedSession);
        } catch (error) {
          console.log('No delayed session available yet, using original session');
          setDelayedGameSession(session);
        }

        // Join spectate mode
        await gameSessionService.joinSpectate(gameId, user.id);
        setIsSpectating(true);

        // Set up game state
        const activeSession = delayedGameSession || session;
        setGameState(activeSession.gameState);
        setTimers(activeSession.timers);

        // Set up player stats
        const whitePlayer = activeSession.whitePlayer;
        const blackPlayer = Array.isArray(activeSession.blackPlayer)
          ? activeSession.blackPlayer[0]
          : activeSession.blackPlayer;

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

        toast({
          title: "Joined Spectate Mode",
          description: `Now spectating ${whitePlayer?.username || 'Unknown'} vs ${blackPlayer?.username || 'Unknown'}`,
        });

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

    initializeSpectate();

    // Cleanup on unmount
    return () => {
      if (gameId && currentUser && isSpectating) {
        gameSessionService.leaveSpectate(gameId, currentUser.id).catch(console.error);
      }
    };
  }, [gameId, navigate, toast]);

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
        {/* Header */}
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate('/lobby')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4"/>
              Back to Lobby
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Eye className="h-5 w-5"/>
                Spectating Game
              </h1>
              <p className="text-sm text-muted-foreground">
                {playerStats.white.name} vs {playerStats.black.name}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleLeaveSpectate}
            className="flex items-center gap-2"
          >
            <EyeOff className="h-4 w-4"/>
            Leave Spectate
          </Button>
        </div>

        {/* Game Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Main Game Area */}
          <div className="lg:col-span-3">
            <div className="flex flex-col-reverse md:flex-col gap-4">
              {/* Player Info and Timer */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PlayerInfo
                  name={playerStats.black.name}
                  points={playerStats.black.points}
                  color="black"
                  isCurrentPlayer={gameState.currentTurn === "black"}
                />
                <ChessTimer
                  timers={timers}
                  gameId={gameId!}
                  isGameOver={false}
                  onError={() => {
                  }} setTimers={function (value: React.SetStateAction<GameTimers>): void {
                  throw new Error('Function not implemented.');
                }} currentPlayer={'white'} onTimeout={function (color: PieceColor): void {
                  throw new Error('Function not implemented.');
                }}/>
                <PlayerInfo
                  name={playerStats.white.name}
                  points={playerStats.white.points}
                  color="white"
                  isCurrentPlayer={gameState.currentTurn === "white"}
                />
              </div>

              {/* Chess Board */}
              <div className="flex justify-center">
                <ChessBoard
                  gameState={gameState}
                  onMoveMade={() => {
                  }} // No moves allowed in spectate mode
                  isSpectateMode={true}
                  gameId={gameId!}
                  SpectatorId={currentUser?.id || ''} onGameEnd={function (result: GameResult): Promise<void> {
                  throw new Error('Function not implemented.');
                }} onTimeout={function (color: PieceColor): void {
                  throw new Error('Function not implemented.');
                }}                />
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <SpectatorList gameId={gameId!} />
            <SpectatorChat gameId={gameId!} />
          </div>
        </div>

        {/* Spectate Notice */}
        <div className="mt-4 text-center">
          <p className="text-sm text-muted-foreground">
            👁️ You are spectating this game. Moves are delayed by 2 plies to prevent cheating.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SpectatePage;
