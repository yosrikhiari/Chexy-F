import React, { useState, useEffect, Component } from "react";
import { useNavigate } from "react-router-dom";
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
import { gameService } from "@/services/GameService.ts";
import { aiserervice } from "@/services/aiService.ts";

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
    isDraw: false,
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
    canBlackCastleQueenSide: true
  });
  const [timers, setTimers] = useState<GameTimers | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
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

  const navigate = useNavigate();
  const handleBackToMenu = () => {
    setIsModalOpen(false);
    navigate('/game-select');
  };

  useEffect(() => {
    const initializeGame = async () => {
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
          session = await gameSessionService.getGameSession(propGameId);
        } else {
          session = await gameSessionService.createGameSession(user.id, mode || "CLASSIC_SINGLE_PLAYER", isRankedMatch);
        }
        setGameSession(session);
        setGameState({
          ...session.gameState,
          gameSessionId: session.gameId,
          userId1: session.whitePlayer.userId,
          userId2: session.blackPlayer?.userId || "BOT",
        });
        setCurrentPlayer(session.gameState.currentTurn);

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
            active: session.gameState.currentTurn.toLowerCase() === "white",
          },
          black: {
            timeLeft: session.timers?.black?.timeLeft ?? 600,
            active: session.gameState.currentTurn.toLowerCase() === "black",
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

  // Monitor game state for end conditions
  useEffect(() => {
    const checkGameEnd = async () => {
      if (!gameSession || !gameState.gameSessionId) return;

      try {
        const session = await gameSessionService.getGameSession(gameState.gameSessionId);
        const isGameEnded = session.status === "COMPLETED" ||
          gameState.isCheckmate ||
          gameState.isDraw ||
          (gameResult && ['checkmate', 'resignation', 'draw', 'tie_resolved'].includes(gameResult.gameEndReason));

        if (isGameEnded) {
          setIsGameOver(true);
          setTimers((prev) => {
            if (!prev) return prev;
            return {
              ...prev,
              white: { ...prev.white, active: false },
              black: { ...prev.black, active: false },
            };
          });
        }
      } catch (error) {
        console.error("Error checking game end:", error);
        toast({ title: "Error", description: "Failed to check game status.", variant: "destructive" });
      }
    };

    checkGameEnd();
  }, [gameState, gameSession, gameResult]);

  // Handle game end
  const handleGameEnd = async (result: GameResult) => {
    setGameResult(result);
    setIsModalOpen(true);
    setIsGameOver(true);

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
        await gameSessionService.endGame(gameSession.gameId, result.winnerid, result.gameEndReason === "draw" || result.gameEndReason === "tie_resolved");
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
            active: session.gameState.currentTurn.toLowerCase() === "white",
          },
          black: {
            timeLeft: session.timers?.black?.timeLeft ?? 600,
            active: session.gameState.currentTurn.toLowerCase() === "black",
          },
          defaultTime: session.timers?.defaultTime ?? 600,
        });
        setGameResult(null);
        setIsModalOpen(false);
        setIsGameOver(false);

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
    if (!isGameOver) {
      setTimers((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          white: { ...prev.white, active: color === "white" },
          black: { ...prev.black, active: color === "black" },
        };
      });
    }
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
                  isGameOver={isGameOver}
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
                onGameEnd={handleGameEnd}
                gameState={gameState}
                onGameStateChange={setGameState}
                timers={timers}
                onTimeUpdate={setTimers}
                onTimeout={(color) => {
                  const winner = color === "white" ? "black" : "white";
                  const winnerName = winner === "white"
                    ? playerStats.white.name
                    : playerStats.black.name;
                  const winnerId = winner === "white" ? gameState.userId1 : gameState.userId2;

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
                onResetGame={resetGame} board={[]}
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
                    {isGameOver ? (
                      <p className="text-red-600 font-medium">Game Over</p>
                    ) : gameState.isCheck ? (
                      <p className="text-amber-600 font-medium">Check!</p>
                    ) : gameState.isCheckmate ? (
                      <p className="text-red-600 font-medium">Checkmate!</p>
                    ) : (
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
          onReviewGame={() => setIsModalOpen(false)}
          onBackToMenu={handleBackToMenu}
          isRankedMatch={isRankedMatch}
        />
      </div>
    </ErrorBoundary>
  );
};

export default ChessGameLayoutOverride;
