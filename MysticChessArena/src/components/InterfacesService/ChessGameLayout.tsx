import React, { useState, useEffect } from "react";
import ChessBoard from "./ChessBoard.tsx";
import GameControls from "./GameControls.tsx";
import PlayerInfo from "./PlayerInfo.tsx";
import ChessTimer from "./ChessTimer.tsx";
import GameEndModal from "./GameEndModal.tsx";
import { PieceColor, GameTimers, GameState, GameResult, PlayerStats } from "@/Interfaces/types/chess.ts";
import { ChessGameLayoutProps } from "@/Interfaces/ChessGameLayoutProps.ts";
import { GameSession } from "@/Interfaces/types/GameSession.ts";
import { toast } from "@/components/ui/use-toast.tsx";
import { User } from "@/Interfaces/user/User.ts";
import { authService } from "@/services/AuthService.ts";
import {userService} from "@/services/UserService.ts";
import {JwtService} from "@/services/JwtService.ts";
import {gameSessionService} from "@/services/GameSessionService.ts";
import {gameHistoryService} from "@/services/GameHistoryService.ts";


const ChessGameLayoutOverride: React.FC<ChessGameLayoutProps> = ({
                                                                   className = "",
                                                                   isRankedMatch = false,
                                                                   gameId: propGameId,
                                                                   playerId: propPlayerId,
                                                                 }) => {
  const [currentPlayer, setCurrentPlayer] = useState<PieceColor>("white");
  const [gameState, setGameState] = useState<GameState>({
    gameSessionId: propGameId || "",
    userId1: propPlayerId || "",
    userId2: "",
    isCheck: false,
    isCheckmate: false,
    checkedPlayer: null,
    enPassantTarget: null,
    currentTurn: "white",
    moveCount: 0,
    canWhiteCastleKingSide: true,
    canWhiteCastleQueenSide: true,
    canBlackCastleKingSide: true,
    canBlackCastleQueenSide: true,
  });
  const [timers, setTimers] = useState<GameTimers>({
    white: { timeLeft: 600, active: true },
    black: { timeLeft: 600, active: false },
    defaultTime: 600,
  });
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [playerStats, setPlayerStats] = useState<{
    white: PlayerStats;
    black: PlayerStats;
  }>({
    white: { playerId: propPlayerId || "", name: "Guest", points: 0 },
    black: { playerId: "", name: "Opponent", points: 0 },
  });
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch current user and create game session on mount
  useEffect(() => {
    const initializeGame = async () => {
      try {
        if (!authService.isLoggedIn()) {
          toast({ title: "Error", description: "Please log in to start a game.", variant: "destructive" });
          return;
        }

        const keycloakId = JwtService.getKeycloakId();
        if (!keycloakId) {
          toast({ title: "Error", description: "No Keycloak ID found.", variant: "destructive" });
          return;
        }

        const user = await userService.getCurrentUser(keycloakId);
        setCurrentUser(user);

        let session: GameSession;
        if (propGameId && propPlayerId) {
          session = await gameSessionService.getGameSession(propGameId);
        } else {
          session = await gameSessionService.createGameSession(user.id, "CLASSIC_MULTIPLAYER", isRankedMatch);
        }

        setGameSession(session);
        setGameState({
          ...session.gameState,
          gameSessionId: session.gameId,
          userId1: session.whitePlayer.userId,
          userId2: session.blackPlayer?.userId || "",
        });
        setCurrentPlayer(session.gameState.currentTurn);
        setPlayerStats({
          white: {
            playerId: session.whitePlayer.userId,
            name: session.whitePlayer.username,
            points: session.whitePlayer.currentStats.points,
          },
          black: {
            playerId: session.blackPlayer?.userId || "",
            name: session.blackPlayer?.username || "Opponent",
            points: session.blackPlayer?.currentStats.points || 0,
          },
        });

        await gameSessionService.startGame(session.gameId);
      } catch (error) {
        toast({ title: "Error", description: "Failed to initialize game.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    initializeGame();
  }, [propGameId, propPlayerId, isRankedMatch]);

  // Monitor for black player joining
  useEffect(() => {
    if (!gameSession || gameSession.blackPlayer?.userId) return;

    const interval = setInterval(async () => {
      try {
        const updatedSession = await gameSessionService.getGameSession(gameSession.gameId);
        if (updatedSession.blackPlayer?.userId) {
          setGameSession(updatedSession);
          setGameState((prev) => ({
            ...prev,
            userId2: updatedSession.blackPlayer.userId,
          }));
          setPlayerStats((prev) => ({
            ...prev,
            black: {
              playerId: updatedSession.blackPlayer.userId,
              name: updatedSession.blackPlayer.username || "Opponent",
              points: updatedSession.blackPlayer.currentStats.points,
            },
          }));
        }
      } catch (error) {
        console.error("Failed to check for black player:", error);
      }
    }, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, [gameSession]);

  // Handle game end
  const handleGameEnd = async (result: GameResult) => {
    setGameResult(result);
    setIsModalOpen(true);

    // Stop all timers
    setTimers((prev) => ({
      ...prev,
      white: { ...prev.white, active: false },
      black: { ...prev.black, active: false },
    }));

    try {
      if (gameSession) {
        // Create and complete game history
        const history = await gameHistoryService.createGameHistory(gameSession.gameId);
        await gameHistoryService.completeGameHistory(history.id, result);

        // End game session
        await gameSessionService.endGame(gameSession.gameId, result.winnerid);

        // Update player points
        await userService.updateUserPoints(result.winnerid, result.pointsAwarded);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update game history or points.",
        variant: "destructive",
      });
    }
  };

  // Reset the game
  const resetGame = async () => {
    try {
      if (currentUser && authService.isLoggedIn()) {
        // Create a new game session
        const session = await gameSessionService.createGameSession(
          currentUser.id,
          "CLASSIC_MULTIPLAYER",
          false
        );
        setGameSession(session);
        setGameState({
          ...session.gameState,
          gameSessionId: session.gameId,
          userId1: session.whitePlayer.userId,
          userId2: session.blackPlayer?.userId || "",
        });
        setCurrentPlayer(session.gameState.currentTurn);
        setPlayerStats((prev) => ({
          ...prev,
          black: {
            playerId: session.blackPlayer?.userId || "",
            name: session.blackPlayer?.username || "Opponent",
            points: session.blackPlayer?.currentStats.points || 0,
          },
        }));
        setTimers({
          white: { timeLeft: timers.defaultTime, active: true },
          black: { timeLeft: timers.defaultTime, active: false },
          defaultTime: timers.defaultTime,
        });
        setGameResult(null);
        setIsModalOpen(false);

        // Start the new game
        await gameSessionService.startGame(session.gameId);
      } else {
        toast({
          title: "Error",
          description: "Please log in to start a new game.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reset game.",
        variant: "destructive",
      });
    }
  };

  // Handle player change
  const handlePlayerChange = (color: PieceColor) => {
    setCurrentPlayer(color);
    setTimers((prev) => ({
      ...prev,
      white: { ...prev.white, active: color === "white" },
      black: { ...prev.black, active: color === "black" },
    }));
  };



  return (
    <div className={`${className}`}>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <div className="flex flex-col-reverse md:flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <PlayerInfo
                name={playerStats.black.name}
                points={playerStats.black.points}
                color="black"
                isCurrentPlayer={currentPlayer === "black"}
                userId={playerStats.black.playerId}
                gameId={gameState.gameSessionId}
              />
              <ChessTimer
                timers={timers}
                setTimers={setTimers}
                currentPlayer={currentPlayer}
                isGameOver={!!gameResult}
                onTimeout={(color) => {
                  const winner = color === "white" ? "black" : "white";
                  const winnerName =
                    winner === "white"
                      ? playerStats.white.name
                      : playerStats.black.name;
                  const winnerId =
                    winner === "white"
                      ? gameState.userId1
                      : gameState.userId2;

                  handleGameEnd({
                    winner,
                    winnerName,
                    pointsAwarded: isRankedMatch ? 15 : 0,
                    gameEndReason: "timeout",
                    gameid: gameState.gameSessionId,
                    winnerid: winnerId || "",
                  });
                }}
              />
              <PlayerInfo
                name={playerStats.white.name}
                points={playerStats.white.points}
                color="white"
                isCurrentPlayer={currentPlayer === "white"}
                userId={playerStats.white.playerId}
                gameId={gameState.gameSessionId}
              />
            </div>

            <ChessBoard
              currentPlayer={currentPlayer}
              onMove={handlePlayerChange}
              gameState={gameState}
              onGameStateChange={setGameState}
              timers={timers}
              onTimeUpdate={setTimers}
              onTimeout={(color) => {
                const winner = color === "white" ? "black" : "white";
                const winnerName =
                  winner === "white"
                  ? playerStats.white.name
                  : playerStats.black.name;
                const winnerId =
                  winner === "white" ? gameState.userId1 : gameState.userId2;

                handleGameEnd({
                  winner,
                  winnerName,
                  pointsAwarded: isRankedMatch ? 15 : 0,
                  gameEndReason: "timeout",
                  gameid: gameState.gameSessionId,
                  winnerid: winnerId || "",
                });
              }}
              player1Name={playerStats.white.name}
              player2Name={playerStats.black.name}
              onResetGame={resetGame}
            />

            <GameControls
              onResign={() => {
                const winner = currentPlayer === "white" ? "black" : "white";
                const winnerName =
                  winner === "white"
                  ? playerStats.white.name
                  : playerStats.black.name;
                const winnerId =
                  winner === "white" ? gameState.userId1 : gameState.userId2;

                handleGameEnd({
                  winner,
                  winnerName,
                  pointsAwarded: isRankedMatch ? 10 : 0,
                  gameEndReason: "resignation",
                  gameid: gameState.gameSessionId,
                  winnerid: winnerId || "",
                });
              }}
              onReset={resetGame}
              gameState={gameState}
              currentPlayer={currentPlayer}
            />
          </div>
        </div>

        <div className="lg:col-span-1">
          <div className="bg-muted p-4 rounded-lg h-full">
            <h3 className="font-bold text-xl mb-4">Game Info</h3>

            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-1">Game Type</h4>
                <p
                  className="text-sm bg-primary/10 text-primary font-medium px-2 py-1 rounded inline-block"
                >
                  {isRankedMatch ? "Ranked Match" : "Normal Match"}
                </p>
              </div>

              <div>
                <h4 className="font-medium mb-1">Current Turn</h4>
                <div className="flex items-center gap-2">
                  <div
                    className={`w-4 h-4 rounded-full ${
  currentPlayer === "white"
    ? "bg-white border border-black/20"
    : "bg-black"
}`}
                  ></div>
                  <span className="capitalize">{currentPlayer}</span>
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-1">Game Status</h4>
                <div>
                  {gameState.isCheck && (
                    <p className="text-amber-600 font-medium">Check!</p>
                  )}
                  {gameState.isCheckmate && (
                    <p className="text-red-600 font-medium">Checkmate!</p>
                  )}
                  {!gameState.isCheck && !gameState.isCheckmate && (
                    <p className="text-green-600 font-medium">In Progress</p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="font-medium mb-1">Points at Stake</h4>
                <p className="text-lg font-bold text-primary">
                  {isRankedMatch ? "25" : "0"}
                </p>
                {!isRankedMatch && (
                  <p className="text-xs text-muted-foreground">
                    Casual match - no points awarded
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <GameEndModal
        open={isModalOpen}
        gameResult={gameResult}
        onClose={() => setIsModalOpen(false)}
        onPlayAgain={resetGame}
        isRankedMatch={isRankedMatch}
      />
    </div>
  );
};

export default ChessGameLayoutOverride;

