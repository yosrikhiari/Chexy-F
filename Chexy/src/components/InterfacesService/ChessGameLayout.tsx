import React, { useState, useEffect, Component } from "react";
import { useNavigate } from "react-router-dom";
import ChessBoard from "./ChessBoard.tsx";
import GameControls from "./GameControls.tsx";
import PlayerInfo from "./PlayerInfo.tsx";
import ChessTimer from "./ChessTimer.tsx";
import GameEndModal from "./GameEndModal.tsx";
import { PieceColor, GameTimers, GameState, GameResult, PlayerStats, PieceType, BoardPosition } from "@/Interfaces/types/chess.ts";
import { ChessGameLayoutProps } from "@/Interfaces/ChessGameLayoutProps.ts";
import { GameSession } from "@/Interfaces/types/GameSession.ts";
import { toast } from "@/components/ui/use-toast.tsx";
import { User } from "@/Interfaces/user/User.ts";
import { authService } from "@/services/AuthService.ts";
import { userService } from "@/services/UserService.ts";
import { JwtService } from "@/services/JwtService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { gameHistoryService } from "@/services/GameHistoryService.ts";
import { aiserervice } from "@/services/aiService.ts";
import { PlayerAction } from "@/Interfaces/services/PlayerAction.ts";

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

// Opening interface
interface ChessOpening {
  eco: string;
  name: string;
}

// Extend PlayerAction to include pieceType and additional move details
type ExtendedPlayerAction = PlayerAction & {
  pieceType: PieceType;
  resultsInCheck?: boolean;
  resultsInCheckmate?: boolean;
  resultsInStalemate?: boolean;
};

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
    canBlackCastleQueenSide: true,
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
  const [localMoveHistory, setLocalMoveHistory] = useState<ExtendedPlayerAction[]>([]);

  // Add opening detection state
  const [currentOpening, setCurrentOpening] = useState<ChessOpening | null>(null);
  const [isDetectingOpening, setIsDetectingOpening] = useState(false);

  const navigate = useNavigate();
  const handleBackToMenu = () => {
    setIsModalOpen(false);
    navigate('/');
  };

  // Convert move to algebraic notation with move type indicators
  const moveToAlgebraicNotation = (action: ExtendedPlayerAction): string => {
    if (!action.from || !action.to || !Array.isArray(action.from) || !Array.isArray(action.to)) {
      return "Invalid move";
    }

    const pieceMap: { [key: string]: string } = {
      king: 'K',
      queen: 'Q',
      rook: 'R',
      bishop: 'B',
      knight: 'N',
      pawn: '',
    };

    const fromCol = String.fromCharCode(97 + action.from[1]);
    const toCol = String.fromCharCode(97 + action.to[1]);
    const toRow = 8 - action.to[0];

    const pieceType = action.pieceType || 'pawn';
    const isCapture = action.actionType === 'capture';

    let notation = '';
    if (pieceType === 'pawn') {
      if (isCapture) {
        notation = `${fromCol}x${toCol}${toRow}`;
      } else {
        notation = `${toCol}${toRow}`;
      }
    } else {
      notation = `${pieceMap[pieceType]}${isCapture ? 'x' : ''}${toCol}${toRow}`;
    }

    // Append indicators for check, checkmate, or stalemate
    if (action.resultsInCheckmate) {
      notation += '#';
    } else if (action.resultsInCheck) {
      notation += '+';
    } else if (action.resultsInStalemate) {
      notation += ' (stalemate)';
    }

    return notation;
  };


  useEffect(() => {
    if (localMoveHistory.length > 0) {
      detectOpeningAfterMove();
    }
  }, [localMoveHistory]);

  // Function to detect opening after each move
  const detectOpeningAfterMove = async () => {
    if (!gameState.gameSessionId || isDetectingOpening || localMoveHistory.length === 0) return;

    try {
      setIsDetectingOpening(true);
      const moves = localMoveHistory.map(action => ({
        from: { row: action.from[0], col: action.from[1] },
        to: { row: action.to[0], col: action.to[1] }
      }));
      console.log("Sending moves for opening detection:", JSON.stringify(moves, null, 2));
      const detectedOpening = await aiserervice.updateAndDetectOpening(gameState.gameSessionId, moves);

      if (detectedOpening) {
        console.log("Detected opening:", detectedOpening); // Debug log
        setCurrentOpening(detectedOpening);
        localStorage.setItem(`opening_${gameState.gameSessionId}`, JSON.stringify(detectedOpening));
      } else {
        console.log("No opening detected from backend response");
        setCurrentOpening(null);
      }
    } catch (error) {
      console.error("Error detecting opening:", error);
      setCurrentOpening(null);
    } finally {
      setIsDetectingOpening(false);
    }
  };

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
          // Check if the game is already active or completed
          if (session.status === "ACTIVE" || session.status === "COMPLETED") {
            setGameSession(session);
            setGameState({
              ...session.gameState,
              gameSessionId: session.gameId,
              userId1: session.whitePlayer.userId,
              userId2: (Array.isArray(session.blackPlayer) ? session.blackPlayer[0]?.userId : (session as any).blackPlayer?.userId) || "BOT",
            });
            setCurrentPlayer(session.gameState.currentTurn);
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
            // Load move history from localStorage
            const savedMoveHistory = localStorage.getItem(`moveHistory_${propGameId}`);
            if (savedMoveHistory) {
              const parsedHistory = JSON.parse(savedMoveHistory);
              console.log("Loaded move history:", parsedHistory);
              setLocalMoveHistory(parsedHistory);
            } else {
              setLocalMoveHistory([]);
            }
            // Load opening from localStorage
            const savedOpening = localStorage.getItem(`opening_${propGameId}`);
            if (savedOpening) {
              setCurrentOpening(JSON.parse(savedOpening));
            }
            return; // Exit early since the game is already started or completed
          }
        } else {
          session = await gameSessionService.createGameSession(user.id, mode || "CLASSIC_SINGLE_PLAYER", isRankedMatch);
        }
        setGameSession(session);
            setGameState({
          ...session.gameState,
          gameSessionId: session.gameId,
          userId1: session.whitePlayer.userId,
          userId2: (Array.isArray(session.blackPlayer) ? session.blackPlayer[0]?.userId : (session as any).blackPlayer?.userId) || "BOT",
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
      } catch (error) {
        console.error("Error in initializeGame:", error);
        toast({ title: "Error", description: "Failed to initialize game.", variant: "destructive" });
      } finally {
        setIsLoading(false);
      }
    };
    initializeGame();
  }, [propGameId, propPlayerId, isRankedMatch, mode]);

  useEffect(() => {
    if (mode === "CLASSIC_SINGLE_PLAYER" || !gameSession || (Array.isArray(gameSession.blackPlayer) ? gameSession.blackPlayer[0]?.userId : (gameSession as any).blackPlayer?.userId)) return;

    const interval = setInterval(async () => {
      try {
        const updatedSession = await gameSessionService.getGameSession(gameSession.gameId);
        const blackP = Array.isArray(updatedSession.blackPlayer) ? updatedSession.blackPlayer[0] : (updatedSession as any).blackPlayer;
        if (blackP?.userId) {
          setGameSession(updatedSession);
          setGameState((prev) => ({
            ...prev,
            userId2: blackP.userId,
          }));
          setPlayerStats((prev) => ({
            ...prev,
            black: {
              playerId: blackP.userId,
              name: blackP.username || "Opponent",
              points: blackP.currentStats?.points ?? 0,
            },
          }));
        }
      } catch (error) {
        console.error("Failed to check for black player:", error);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [gameSession, mode]);

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
          userId2: (Array.isArray(session.blackPlayer) ? session.blackPlayer[0]?.userId : (session as any).blackPlayer?.userId) || "",
        });
        setCurrentPlayer(session.gameState.currentTurn);
        setPlayerStats((prev) => ({
          ...prev,
          black: {
            playerId: (Array.isArray(session.blackPlayer) ? session.blackPlayer[0]?.userId : (session as any).blackPlayer?.userId) || "",
            name: (Array.isArray(session.blackPlayer) ? session.blackPlayer[0]?.username : (session as any).blackPlayer?.username) || "Bot",
            points: (Array.isArray(session.blackPlayer) ? session.blackPlayer[0]?.currentStats?.points : (session as any).blackPlayer?.currentStats?.points) ?? 0,
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
        setLocalMoveHistory([]);
        setCurrentOpening(null); // Reset opening
        localStorage.removeItem(`moveHistory_${gameState.gameSessionId}`); // Clear move history for old session
        localStorage.removeItem(`boardHistory_${gameState.gameSessionId}`); // Clear board history for old session
        localStorage.removeItem(`opening_${gameState.gameSessionId}`); // Clear opening for old session

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
  const handleMoveMade = async (move: {
    from: BoardPosition;
    to: BoardPosition;
    actionType: 'move' | 'capture';
    pieceType: PieceType;
    resultsInCheck?: boolean;
    resultsInCheckmate?: boolean;
    resultsInStalemate?: boolean;
  }) => {
    const newAction: ExtendedPlayerAction = {
      gameId: gameState.gameSessionId,
      playerId: currentPlayer === 'white' ? gameState.userId1 : gameState.userId2,
      actionType: move.actionType,
      from: [move.from.row, move.from.col],
      to: [move.to.row, move.to.col],
      timestamp: Date.now(),
      sequenceNumber: localMoveHistory.length + 1,
      pieceType: move.pieceType,
      resultsInCheck: move.resultsInCheck,
      resultsInCheckmate: move.resultsInCheckmate,
      resultsInStalemate: move.resultsInStalemate,
    };

    setLocalMoveHistory(prev => {
      const newHistory = [...prev, newAction];
      localStorage.setItem(`moveHistory_${gameState.gameSessionId}`, JSON.stringify(newHistory));
      detectOpeningAfterMove(); // Call immediately after updating history
      return newHistory;
    });
  };
  useEffect(() => {
    console.log("Current opening state:", currentOpening);
  }, [currentOpening]);

  if (isLoading || !timers) {
    return <div className="text-center p-4">Loading game...</div>;
  }

  return (
    <ErrorBoundary>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
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
                        : (gameState.userId2 || "BOT");

                    handleGameEnd({
                      winner,
                      winnerName,
                      pointsAwarded: isRankedMatch ? 15 : 0,
                      gameEndReason: "timeout",
                      gameid: gameState.gameSessionId,
                      winnerid: winnerId,
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
                  const winnerId = winner === "white"
                    ? gameState.userId1
                    : (gameState.userId2 || "BOT");

                  handleGameEnd({
                    winner,
                    winnerName,
                    pointsAwarded: isRankedMatch ? 15 : 0,
                    gameEndReason: "timeout",
                    gameid: gameState.gameSessionId,
                    winnerid: winnerId,
                  });
                }}
                player1Name={playerStats.white.name}
                player2Name={playerStats.black.name}
                onResetGame={resetGame}
                board={[]}
                onMoveMade={handleMoveMade}
              />

              <GameControls
                onResign={() => {
                  // In single-player, human is white and bot is black.
                  // Resignation is initiated by the human player, so the bot wins.
                  const winner: PieceColor = "black";
                  handleGameEnd({
                    winner,
                    winnerName: playerStats.black.name,
                    pointsAwarded: isRankedMatch ? 10 : 0,
                    gameEndReason: "resignation",
                    gameid: gameState.gameSessionId,
                    winnerid: gameState.userId2 || "BOT",
                  });
                }}
                onReset={resetGame}
                gameState={gameState}
                currentPlayer={currentPlayer}
                onBackToLobby={() => navigate("/lobby")}
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

                {/* Opening Detection Section */}
                <div>
                  <h4 className="font-medium mb-1">Opening</h4>
                  <div className="text-sm">
                    {isDetectingOpening ? (
                      <p className="text-blue-600 font-medium">Analyzing...</p>
                    ) : currentOpening ? (
                      <div className="space-y-1">
                        <p className="font-medium text-primary">
                          {currentOpening.eco}
                        </p>
                        <p className="text-muted-foreground">
                          {currentOpening.name}
                        </p>
                      </div>
                    ) : localMoveHistory.length > 0 ? (
                      <p className="text-muted-foreground">No opening detected</p>
                    ) : (
                      <p className="text-muted-foreground">Game not started</p>
                    )}
                  </div>
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
                <div>
                  <h4 className="font-medium mb-1">Move History</h4>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {localMoveHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No moves yet</p>
                    ) : (
                      <ul className="text-sm space-y-1">
                        {localMoveHistory.reduce((acc: JSX.Element[], action, index) => {
                          if (index % 2 === 0) {
                            acc.push(
                              <li key={action.sequenceNumber}>
                                {Math.floor(index / 2) + 1}. White: {moveToAlgebraicNotation(action)}{' '}
                                {localMoveHistory[index + 1] ? `Black: ${moveToAlgebraicNotation(localMoveHistory[index + 1])}` : ''}
                              </li>
                            );
                          }
                          return acc;
                        }, [])}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <GameEndModal
          open={isModalOpen}
          gameResult={gameResult}
          onClose={() => setIsModalOpen(false)}
          onPlayAgain={() => {
            setIsModalOpen(false);
            navigate("/lobby");
          }}
          onReviewGame={() => setIsModalOpen(false)}
          onBackToMenu={() => {
            setIsModalOpen(false);
            navigate("/lobby");
          }}
          isRankedMatch={isRankedMatch}
        />
      </div>
    </ErrorBoundary>
  );
};

export default ChessGameLayoutOverride;
