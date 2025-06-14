import React, { useState, useEffect, Component } from "react";
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
import { userService } from "@/services/UserService.ts";
import { JwtService } from "@/services/JwtService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { gameHistoryService } from "@/services/GameHistoryService.ts";
import { chessGameService } from "@/services/ChessGameService.ts";
import { gameService } from "@/services/GameService.ts";
import {GameStatus} from "@/Interfaces/enums/GameStatus.ts";
import {aiserervice} from "@/services/aiService.ts";

// Error Boundary Component
class ErrorBoundary extends Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="text-red-500 text-center p-4">
          Something went wrong.{' '}
          <button onClick={() => window.location.reload()} className="underline">
            Refresh the page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ChessGameLayoutOverride: React.FC<ChessGameLayoutProps> = ({
                                                                   className = "",
                                                                   isRankedMatch = false,
                                                                   gameId: propGameId,
                                                                   playerId: propPlayerId,
                                                                   mode,
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
  const [timers, setTimers] = useState<GameTimers | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [playerStats, setPlayerStats] = useState<{
    white: PlayerStats;
    black: PlayerStats;
  }>({
    white: { playerId: propPlayerId || "", name: "Guest", points: 0 },
    black: { playerId: "", name: "Bot", points: 0 },
  });
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeGame = async () => {
      console.log("Initializing game with props:", { propGameId, propPlayerId, mode, isRankedMatch });
      try {
        if (!authService.isLoggedIn()) {
          console.log("User not logged in");
          toast({ title: "Error", description: "Please log in to start a game.", variant: "destructive" });
          return;
        }

        const keycloakId = JwtService.getKeycloakId();
        console.log("Keycloak ID:", keycloakId);
        if (!keycloakId) {
          console.log("No Keycloak ID found");
          toast({ title: "Error", description: "No Keycloak ID found.", variant: "destructive" });
          return;
        }

        const user = await userService.getCurrentUser(keycloakId);
        console.log("Fetched user:", user);
        setCurrentUser(user);

        let session: GameSession;
        if (propGameId && propPlayerId) {
          console.log("Fetching existing game session with gameId:", propGameId);
          session = await gameSessionService.getGameSession(propGameId);
          console.log("Fetched session status:", session.status);
        } else {
          console.log("Creating new game session with mode:", mode, "isRankedMatch:", isRankedMatch);
          session = await gameSessionService.createGameSession(user.id, mode || "CLASSIC_SINGLE_PLAYER", isRankedMatch);
        }
        console.log("Fetched/created session:", session);

        setGameSession(session);
        setGameState({
          ...session.gameState,
          gameSessionId: session.gameId,
          userId1: session.whitePlayer.userId,
          userId2: session.blackPlayer?.userId || "BOT", // Explicitly set bot ID
        });
        setCurrentPlayer(session.gameState.currentTurn);

        // Force start the game if it's single player
        if (mode === "CLASSIC_SINGLE_PLAYER" && session.status !== 'ACTIVE') {
          await gameSessionService.startGame(session.gameId);
          const updatedSession = await gameSessionService.getGameSession(session.gameId);
          setGameSession(updatedSession);
          setGameState(updatedSession.gameState);
          setCurrentPlayer(updatedSession.gameState.currentTurn);
        }
        const timers = {
          white: {
            timeLeft: session.timers?.white?.timeLeft ?? 600,
            active: session.gameState.currentTurn.toLowerCase() === "white" // Add this
          },
          black: {
            timeLeft: session.timers?.black?.timeLeft ?? 600,
            active: session.gameState.currentTurn.toLowerCase() === "black" // Add this
          },
          defaultTime: session.timers?.defaultTime ?? 600,
        };
        setTimers(timers);
        console.log("Timers set to:", timers);

      } catch (error) {
        console.error("Error in initializeGame:", error);
        toast({ title: "Error", description: "Failed to initialize game.", variant: "destructive" });
      } finally {
        console.log("Setting isLoading to false");
        setIsLoading(false);
      }
    };
    initializeGame();
  }, [propGameId, propPlayerId, isRankedMatch, mode]);

  // Update the bot move useEffect
  useEffect(() => {
    if (mode !== "CLASSIC_SINGLE_PLAYER" || currentPlayer !== "black" || gameResult) return;

    const handleBotMove = async () => {
      try {
        console.log("Calculating bot move...");
        const botMove = await aiserervice.getBotMove(gameState.gameSessionId, "black");
        if (botMove) {
          console.log("Executing bot move:", botMove);
          await gameService.executeMove(gameState.gameSessionId, botMove);

          // Update local state
          setGameState(prev => ({
            ...prev,
            currentTurn: "white"
          }));
          setCurrentPlayer("white");

          // Update timers
          setTimers(prev => ({
            ...prev,
            white: { ...prev.white, active: true },
            black: { ...prev.black, active: false },
          }));

          // Refresh game state
          const updatedSession = await gameSessionService.getGameSession(gameState.gameSessionId);
          setGameState(updatedSession.gameState);
        } else {
          console.log("No valid moves for bot");
        }
      } catch (error) {
        console.error("Bot move error:", error);
        toast({
          title: "Error",
          description: "Bot move failed",
          variant: "destructive",
        });
        // Fallback - switch to white player if bot fails
        setCurrentPlayer("white");
      }
    };

    const timer = setTimeout(handleBotMove, 1000);
    return () => clearTimeout(timer);
  }, [currentPlayer, gameState.gameSessionId, mode, gameResult]);

  // Monitor for black player joining (skip for single-player)
  useEffect(() => {
    if (mode === "CLASSIC_SINGLE_PLAYER" || !gameSession || gameSession.blackPlayer?.userId) return;

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
              points: updatedSession.blackPlayer.currentStats?.points ?? 0,
            },
          }));
        }
      } catch (error) {
        console.error("Failed to check for black player:", error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [gameSession, mode]);

  // Handle game end
  const handleGameEnd = async (result: GameResult) => {
    setGameResult(result);
    setIsModalOpen(true);

    setTimers((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        white: { ...prev.white, active: false },
        black: { ...prev.black, active: false },
      };
    });

    try {
      if (gameSession) {
        const history = await gameHistoryService.createGameHistory(gameSession.gameId);
        await gameHistoryService.completeGameHistory(history.id, result);
        await gameSessionService.endGame(gameSession.gameId, result.winnerid);
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
        const session = await gameSessionService.createGameSession(
          currentUser.id,
          mode || "CLASSIC_MULTIPLAYER",
          isRankedMatch
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
            name: session.blackPlayer?.username || "Bot",
            points: session.blackPlayer?.currentStats?.points ?? 0,
          },
        }));
        setTimers({
          white: {
            timeLeft: session.timers?.white?.timeLeft ?? 600,
            active: session.timers?.white?.active ?? true,
          },
          black: {
            timeLeft: session.timers?.black?.timeLeft ?? 600,
            active: session.timers?.black?.active ?? false,
          },
          defaultTime: session.timers?.defaultTime ?? 600,
        });
        setGameResult(null);
        setIsModalOpen(false);

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
    setTimers((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        white: { ...prev.white, active: color === "white" },
        black: { ...prev.black, active: color === "black" },
      };
    });
  };

  if (isLoading || !timers) {
    console.log("Rendering loading state. isLoading:", isLoading, "timers:", timers);
    return <div className="text-center p-4">Loading game...</div>;
  }

  return (
    <ErrorBoundary>
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
                  gameId={gameState.gameSessionId}
                  playerId={propPlayerId}
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
                  <p className="text-sm bg-primary/10 text-primary font-medium px-2 py-1 rounded inline-block">
                    {isRankedMatch ? "Ranked Match" : mode === "CLASSIC_SINGLE_PLAYER" ? "Single Player" : "Normal Match"}
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
    </ErrorBoundary>
  );
};

export default ChessGameLayoutOverride;
