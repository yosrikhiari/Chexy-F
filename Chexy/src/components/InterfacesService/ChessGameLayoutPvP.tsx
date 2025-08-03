
import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import GameControls from "./GameControls.tsx";
import PlayerInfo from "./PlayerInfo.tsx";
import ChessTimer from "./ChessTimer.tsx";
import GameEndModal from "./GameEndModal.tsx";
import { PieceColor, GameTimers, GameState, GameResult, PlayerStats, PieceType, BoardPosition } from "@/Interfaces/types/chess.ts";
import { toast } from "@/components/ui/use-toast.tsx";
import { userService} from "@/services/UserService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { gameHistoryService } from "@/services/GameHistoryService.ts";
import { JwtService } from "@/services/JwtService.ts";
import ChessBoardPvP from "@/components/InterfacesService/ChessBoardPvP.tsx";
import { PlayerAction } from "@/Interfaces/services/PlayerAction.ts";
import { chessGameService } from "@/services/ChessGameService.ts";
import {PointCalculationService} from "@/utils/PointsCalculatorService.ts";


interface ChessGameLayoutPvPProps {
  className?: string;
  isRankedMatch: boolean;
}

type ExtendedPlayerAction = PlayerAction & {
  pieceType: PieceType;
  playerColor: PieceColor;
  resultsInCheck?: boolean;
  resultsInCheckmate?: boolean;
  resultsInStalemate?: boolean;
};

const normalizePlayerData = (playerData: any) => {
  if (!playerData) return null;
  if (Array.isArray(playerData)) {
    return playerData.length > 0 ? playerData[0] : null;
  }
  if (typeof playerData === 'object') {
    return playerData;
  }
  return null;
};

const ChessGameLayoutPvP: React.FC<ChessGameLayoutPvPProps> = ({
                                                                 className = "",
                                                                 isRankedMatch,
                                                               }) => {
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [currentPlayer, setCurrentPlayer] = useState<PieceColor>("white");
  const [gameState, setGameState] = useState<GameState>({
    isDraw: false,
    gameSessionId: gameId || "",
    userId1: "",
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
  const [isReviewMode] = useState(false);
  const [playerStats, setPlayerStats] = useState<{
    white: PlayerStats;
    black: PlayerStats;
  }>({
    white: { playerId: "", name: "White", points: 0 },
    black: { playerId: "", name: "Black", points: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [localMoveHistory, setLocalMoveHistory] = useState<ExtendedPlayerAction[]>([]);
  const [playerId, setPlayerId] = useState<string>("");
  const [playerColor, setPlayerColor] = useState<PieceColor>("white");
  const [flipped, setFlipped] = useState(false);
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [initialPoints, setInitialPoints] = useState<number | null>(null);

  const moveToAlgebraicNotation = (action: ExtendedPlayerAction): string => {
    if (!action || !action.from || !action.to ||
      !Array.isArray(action.from) || !Array.isArray(action.to) ||
      action.from.length !== 2 || action.to.length !== 2) {
      return "Move";
    }

    const pieceMap: { [key: string]: string } = {
      king: "K", queen: "Q", rook: "R", bishop: "B", knight: "N", pawn: "",
    };

    const fromCol = String.fromCharCode(97 + action.from[1]);
    const toCol = String.fromCharCode(97 + action.to[1]);
    const toRow = 8 - action.to[0];
    const pieceType = action.pieceType || "pawn";
    const isCapture = action.actionType === "capture";

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

    if (action.resultsInCheckmate) notation += "#";
    else if (action.resultsInCheck) notation += "+";
    else if (action.resultsInStalemate) notation += " (stalemate)";
    return notation;
  };

  const determinePlayerColor = (actionPlayerId: string): PieceColor => {
    if (actionPlayerId === playerStats.white.playerId) {
      return "white";
    } else if (actionPlayerId === playerStats.black.playerId) {
      return "black";
    }
    if (actionPlayerId === gameState.userId1) {
      return "white";
    } else if (actionPlayerId === gameState.userId2) {
      return "black";
    }
    return "white";
  };

  const determinePieceType = (actionType: string, fromX: number, fromY: number, toX: number, toY: number): PieceType => {
    if (actionType === "DOUBLE_PAWN_PUSH") {
      return "pawn";
    }

    const rowDiff = Math.abs(toX - fromX);
    const colDiff = Math.abs(toY - fromY);

    if (colDiff === 0 && (rowDiff === 1 || rowDiff === 2)) {
      return "pawn";
    }

    if (rowDiff === 1 && colDiff === 1 && actionType === "CAPTURE") {
      return "pawn";
    }

    if ((rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2)) {
      return "knight";
    }

    if (rowDiff === colDiff && rowDiff > 0) {
      return "bishop";
    }

    if ((rowDiff === 0 && colDiff > 0) || (colDiff === 0 && rowDiff > 0)) {
      return "rook";
    }

    if (rowDiff <= 1 && colDiff <= 1 && (rowDiff + colDiff) > 0) {
      return "king";
    }

    if ((rowDiff === colDiff) || (rowDiff === 0) || (colDiff === 0)) {
      return "queen";
    }

    return "pawn";
  };

  interface ServerPlayerAction {
    gameSessionId: string;
    playerId: string;
    actionType: string; // "CAPTURE", "MOVE", etc.
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    timestamp: string | number;
    sequenceNumber?: number;
    pieceType?: PieceType;
    resultsInCheck?: boolean;
    resultsInCheckmate?: boolean;
    resultsInStalemate?: boolean;
  }

  const loadMoveHistoryFromServer = async () => {
    if (!gameId) return;

    try {
      // Cast the response to handle both server and client formats
      const playerActions = await gameHistoryService.getPlayerActions(gameId) as (ServerPlayerAction | ExtendedPlayerAction)[];

      const extendedActions: ExtendedPlayerAction[] = playerActions
        .filter(action => {
          // Check if action has the expected server format (fromX, fromY, toX, toY)
          // OR the client format (from, to arrays)
          const hasServerFormat = action &&
            'fromX' in action && 'fromY' in action && 'toX' in action && 'toY' in action &&
            typeof (action as ServerPlayerAction).fromX === 'number' &&
            typeof (action as ServerPlayerAction).fromY === 'number' &&
            typeof (action as ServerPlayerAction).toX === 'number' &&
            typeof (action as ServerPlayerAction).toY === 'number';

          const hasClientFormat = action &&
            'from' in action && 'to' in action &&
            Array.isArray((action as ExtendedPlayerAction).from) && (action as ExtendedPlayerAction).from.length === 2 &&
            Array.isArray((action as ExtendedPlayerAction).to) && (action as ExtendedPlayerAction).to.length === 2;

          return (hasServerFormat || hasClientFormat) &&
            action.playerId &&
            ('gameSessionId' in action || 'gameId' in action);
        })
        .map(action => {
          // Handle both server format (fromX, fromY, toX, toY) and client format (from[], to[])
          let fromCoords: [number, number];
          let toCoords: [number, number];
          let actionType: "move" | "capture" | "ability";
          let gameId: string;

          if ('fromX' in action) {
            // Server format
            const serverAction = action as ServerPlayerAction;
            fromCoords = [serverAction.fromX, serverAction.fromY];
            toCoords = [serverAction.toX, serverAction.toY];
            actionType = serverAction.actionType === "capture" ? "capture" : "move";
            gameId = serverAction.gameSessionId;
          } else {
            // Client format (already in correct format)
            const clientAction = action as ExtendedPlayerAction;
            fromCoords = clientAction.from;
            toCoords = clientAction.to;
            actionType = clientAction.actionType;
            gameId = clientAction.gameId;
          }

          const convertedAction: ExtendedPlayerAction = {
            gameId: gameId,
            playerId: action.playerId,
            playerColor: determinePlayerColor(action.playerId),
            actionType: actionType,
            from: fromCoords,
            to: toCoords,
            timestamp: typeof action.timestamp === 'number' ? action.timestamp : new Date(action.timestamp).getTime(),
            sequenceNumber: ('sequenceNumber' in action && action.sequenceNumber) ? action.sequenceNumber : 0,
            pieceType: ('pieceType' in action && action.pieceType) ? action.pieceType : determinePieceType(
              actionType === "capture" ? "CAPTURE" : "MOVE",
              fromCoords[0],
              fromCoords[1],
              toCoords[0],
              toCoords[1]
            ),
            resultsInCheck: ('resultsInCheck' in action && action.resultsInCheck) || false,
            resultsInCheckmate: ('resultsInCheckmate' in action && action.resultsInCheckmate) || false,
            resultsInStalemate: ('resultsInStalemate' in action && action.resultsInStalemate) || false,
          };

          return convertedAction;
        });

      extendedActions.sort((a, b) => a.timestamp - b.timestamp);
      setLocalMoveHistory(extendedActions);
      localStorage.setItem(`moveHistory_${gameId}`, JSON.stringify(extendedActions));

    } catch (error) {
      console.warn("Failed to load move history from server:", error);
      const savedMoveHistory = localStorage.getItem(`moveHistory_${gameId}`);
      if (savedMoveHistory) {
        try {
          const parsedHistory = JSON.parse(savedMoveHistory);
          const filteredHistory = parsedHistory.filter((action: any) => {
            return action &&
              action.from && Array.isArray(action.from) && action.from.length === 2 &&
              action.to && Array.isArray(action.to) && action.to.length === 2 &&
              action.playerColor;
          });
          setLocalMoveHistory(filteredHistory);
        } catch (parseError) {
          setLocalMoveHistory([]);
        }
      } else {
        setLocalMoveHistory([]);
      }
    }
  };

  useEffect(() => {
    const initializeGame = async () => {
      try {
        setIsLoading(true);
        const session = await gameSessionService.getGameSession(gameId);

        if (session.status === 'COMPLETED' || session.status === 'TIMEOUT') {
          toast({
            title: "Game Over",
            description: "This game has already ended.",
            variant: "destructive",
          });
          navigate("/lobby");
          return;
        }

        const normalizedWhitePlayer = normalizePlayerData(session.whitePlayer);
        const normalizedBlackPlayer = normalizePlayerData(session.blackPlayer);

        if (!normalizedWhitePlayer) {
          throw new Error("White player data is missing");
        }

        const currentUserId = (await userService.getCurrentUser(JwtService.getKeycloakId())).id;
        const myColor = normalizedWhitePlayer.userId === currentUserId ? "white" : "black";

        setPlayerColor(myColor);
        setPlayerId(currentUserId);
        setFlipped(myColor === "black");

        // Fetch initial points
        const user = await userService.getCurrentUser(JwtService.getKeycloakId());
        setInitialPoints(user.points);

        setGameState({
          ...session.gameState,
          gameSessionId: gameId,
          userId1: normalizedWhitePlayer.userId,
          userId2: normalizedBlackPlayer?.userId || "",
        });

        setCurrentPlayer(session.gameState.currentTurn);

        setPlayerStats({
          white: {
            playerId: normalizedWhitePlayer.userId,
            name: normalizedWhitePlayer.username || "White Player",
            points: 0,
          },
          black: {
            playerId: normalizedBlackPlayer?.userId || "",
            name: normalizedBlackPlayer?.username || "Waiting for player...",
            points: 0,
          },
        });

        setTimers({
          white: {
            timeLeft: session.timers?.white?.timeLeft ?? 600,
            active: session.gameState.currentTurn === "white",
          },
          black: {
            timeLeft: session.timers?.black?.timeLeft ?? 600,
            active: session.gameState.currentTurn === "black",
          },
          defaultTime: session.timers?.defaultTime ?? 600,
        });

        await loadMoveHistoryFromServer();
      } catch (error) {
        console.error("Error initializing game:", error);
        toast({ title: "Error", description: "Failed to load game.", variant: "destructive" });
        navigate("/lobby");
      } finally {
        setIsLoading(false);
      }
    };

    initializeGame();
  }, [gameId, navigate]);


  useEffect(() => {
    // Stop polling if game is over, still loading, in review mode, OR if we have a game result
    if (!gameId || isLoading || isGameOver || isReviewMode || gameResult !== null) {
      return;
    }

    const pollForUpdates = setInterval(async () => {
      // Double-check game over state before making API call
      if (isGameOver || isReviewMode || gameResult !== null) {
        clearInterval(pollForUpdates);
        return;
      }

      try {
        const session = await gameSessionService.getGameSession(gameId);

        // IMPORTANT: Check if session status indicates game ended
        if (session.status === 'COMPLETED' || session.status === 'TIMEOUT') {
          clearInterval(pollForUpdates);
          console.log("[DEBUG] Game session completed, processing game end...");

          // Determine the winner from the session or game state
          let winner: PieceColor;
          let winnerName: string;
          let winnerId: string;
          let gameEndReason: "checkmate" | "timeout" | "resignation" | "draw" = "resignation";

          // Check if it's a draw first
          if (session.gameState?.isDraw) {
            winner = "draw" as any;
            winnerName = "Draw";
            winnerId = "";
            gameEndReason = "draw";
          }
          // Check for checkmate
          else if (session.gameState?.isCheckmate) {
            winner = session.gameState.checkedPlayer === "white" ? "black" : "white";
            winnerName = winner === "white" ? playerStats.white.name : playerStats.black.name;
            // FIX: Properly set winnerId
            winnerId = winner === "white" ? gameState.userId1 : gameState.userId2;
            gameEndReason = "checkmate";
          }
          // Check for timeout
          else if (session.status === 'TIMEOUT') {
            // Determine winner based on whose timer ran out
            winner = currentPlayer === "white" ? "black" : "white";
            winnerName = winner === "white" ? playerStats.white.name : playerStats.black.name;
            // FIX: Properly set winnerId
            winnerId = winner === "white" ? gameState.userId1 : gameState.userId2;
            gameEndReason = "timeout";
          }
          // Default case - assume resignation or other completion
          else {
            winner = currentPlayer === "white" ? "black" : "white";
            winnerName = winner === "white" ? playerStats.white.name : playerStats.black.name;
            // FIX: Properly set winnerId
            winnerId = winner === "white" ? gameState.userId1 : gameState.userId2;
            gameEndReason = "resignation";
          }

          const detectedGameResult: GameResult = {
            winner: winner,
            winnerName: winnerName,
            pointsAwarded: 0, // FIX: Always start with 0, let GameEndModal calculate if ranked
            gameEndReason: gameEndReason,
            gameid: gameState.gameSessionId,
            winnerid: winnerId, // FIX: Now properly set
          };
          // End the game locally
          handleGameEnd(detectedGameResult);

          // Show notification to opponent
          toast({
            title: "Game Ended",
            description: gameEndReason === "resignation"
              ? "Your opponent has resigned"
              : gameEndReason === "timeout"
                ? "Game ended due to timeout"
                : gameEndReason === "draw"
                  ? "Game ended in a draw"
                  : "Game ended in checkmate",
            duration: 5000,
          });

          return;
        }

        const normalizedWhitePlayer = normalizePlayerData(session.whitePlayer);
        const normalizedBlackPlayer = normalizePlayerData(session.blackPlayer);

        if (normalizedBlackPlayer && playerStats.black.name === "Waiting for player...") {
          setPlayerStats(prev => ({
            ...prev,
            black: {
              playerId: normalizedBlackPlayer.userId,
              name: normalizedBlackPlayer.username || "Black Player",
              points: 0
            }
          }));

          setGameState(prev => ({
            ...prev,
            userId2: normalizedBlackPlayer.userId
          }));

          toast({
            title: "Player Joined",
            description: `${normalizedBlackPlayer.username || "Black player"} has joined the game!`,
            duration: 3000
          });
        }

        if (session.gameState.currentTurn !== currentPlayer) {
          setCurrentPlayer(session.gameState.currentTurn);
          await loadMoveHistoryFromServer();
        }

        setGameState(session.gameState);

      } catch (error) {
        console.error("Error polling for updates:", error);
        // Stop polling on error as well
        clearInterval(pollForUpdates);
      }
    }, 2000);

    return () => clearInterval(pollForUpdates);
  }, [gameId, isLoading, playerStats.black.name, currentPlayer, isGameOver, isReviewMode, gameResult]);




// Key changes for ChessGameLayoutPvP.tsx - Replace the handleGameEnd function:

  const handleGameEnd = async (result: GameResult) => {
    console.log("[DEBUG] Game ended:", result);

    if (isGameOver || gameResult !== null) {
      console.log("[DEBUG] Game already ended, ignoring");
      return;
    }

    let correctedResult = { ...result };

    // Fix missing winnerId
    if (!correctedResult.winnerid && correctedResult.winner !== "draw") {
      if (correctedResult.winner === "white") {
        correctedResult.winnerid = gameState.userId1;
      } else if (correctedResult.winner === "black") {
        correctedResult.winnerid = gameState.userId2;
      }
      console.log("[DEBUG] Fixed missing winnerId:", correctedResult.winnerid);
    }

    // NEW: Calculate points based on streak for ranked matches
    if (isRankedMatch) {
      try {
        const currentStreak = await PointCalculationService.getCurrentUserStreak();
        const { gameResult: updatedResult, pointsCalculation } = await PointCalculationService.processGameResultPoints(
          correctedResult,
          currentStreak,
          isRankedMatch
        );

        correctedResult = updatedResult;

        console.log("[DEBUG] Points calculated based on streak:", {
          streak: currentStreak,
          newStreak: pointsCalculation.newStreak,
          pointsAwarded: pointsCalculation.pointsAwarded,
          streakType: pointsCalculation.streakType
        });
      } catch (error) {
        console.error("[DEBUG] Failed to calculate streak-based points:", error);
        correctedResult.pointsAwarded = 0;
      }
    } else {
      correctedResult.pointsAwarded = 0;
    }

    // Set local game state immediately
    setGameResult(correctedResult);
    setIsGameOver(true);
    setIsModalOpen(true);

    setTimers((prev) => prev && ({
      ...prev,
      white: { ...prev.white, active: false },
      black: { ...prev.black, active: false },
    }));

    setGameState(prev => ({
      ...prev,
      isCheckmate: correctedResult.gameEndReason === "checkmate",
      isDraw: correctedResult.winner === "draw" || correctedResult.gameEndReason === "draw",
      currentTurn: prev.currentTurn
    }));

    // Refresh user data after points calculation
    setTimeout(async () => {
      const keycloakId = JwtService.getKeycloakId();
      if (keycloakId) {
        try {
          const updatedUser = await userService.getCurrentUser(keycloakId);
          setTotalPoints(updatedUser.points);
          localStorage.setItem("user", JSON.stringify(updatedUser));
          console.log("[DEBUG] User data refreshed after game end:", updatedUser.points);
        } catch (error) {
          console.error("Failed to fetch updated user:", error);
        }
      }
    }, 1000); // Reduced timeout since we're not waiting for backend

    console.log("[DEBUG] Game end processing completed locally");
  };

  const resetGame = () => {
    localStorage.removeItem(`moveHistory_${gameId}`);
    navigate("/lobby");
  };

  const handlePlayerChange = (color: PieceColor) => {
    // Don't allow player changes in review mode
    if (isReviewMode) return;

    setCurrentPlayer(color);
    if (!isGameOver && timers) {
      setTimers({
        ...timers,
        white: { ...timers.white, active: color === "white" },
        black: { ...timers.black, active: color === "black" },
      });
    }
  };

  const handleMoveMade = (move: {
    from: BoardPosition;
    to: BoardPosition;
    actionType: "move" | "capture";
    pieceType: PieceType;
    resultsInCheck?: boolean;
    resultsInCheckmate?: boolean;
    resultsInStalemate?: boolean;
  }) => {
    // Don't allow moves in review mode
    if (isReviewMode) return;

    const movingPlayerColor = currentPlayer;
    const movingPlayerId = currentPlayer === "white" ? gameState.userId1 : gameState.userId2;

    const newAction: ExtendedPlayerAction = {
      gameId: gameState.gameSessionId,
      playerId: movingPlayerId,
      playerColor: movingPlayerColor,
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
      const existingMove = prev.find(m => {
        if (!m.from || !m.to || !Array.isArray(m.from) || !Array.isArray(m.to) ||
          !newAction.from || !newAction.to || !Array.isArray(newAction.from) || !Array.isArray(newAction.to)) {
          return false;
        }

        return m.from[0] === newAction.from[0] &&
          m.from[1] === newAction.from[1] &&
          m.to[0] === newAction.to[0] &&
          m.to[1] === newAction.to[1] &&
          m.playerColor === newAction.playerColor;
      });

      if (existingMove) {
        return prev;
      }

      const newHistory = [...prev, newAction];
      localStorage.setItem(`moveHistory_${gameState.gameSessionId}`, JSON.stringify(newHistory));
      return newHistory;
    });

    setTimeout(async () => {
      await loadMoveHistoryFromServer();
    }, 1000);
  };

  const checkForGameEnd = async () => {
    if (!gameState.gameSessionId || isReviewMode) return;

    try {
      // Check for checkmate
      const isWhiteCheckmate = await chessGameService.isCheckmate(gameState.gameSessionId, "white");
      const isBlackCheckmate = await chessGameService.isCheckmate(gameState.gameSessionId, "black");

      // Check for draw
      const isWhiteDraw = await chessGameService.isDraw(gameState.gameSessionId, "white");
      const isBlackDraw = await chessGameService.isDraw(gameState.gameSessionId, "black");

      if (isWhiteCheckmate) {
        handleGameEnd({
          winner: "black",
          winnerName: playerStats.black.name,
          pointsAwarded: isRankedMatch ? 15 : 0,
          gameEndReason: "checkmate",
          gameid: gameState.gameSessionId,
          winnerid: gameState.userId2,
        });
      } else if (isBlackCheckmate) {
        handleGameEnd({
          winner: "white",
          winnerName: playerStats.white.name,
          pointsAwarded: isRankedMatch ? 15 : 0,
          gameEndReason: "checkmate",
          gameid: gameState.gameSessionId,
          winnerid: gameState.userId1,
        });
      } else if (isWhiteDraw || isBlackDraw) {
        handleGameEnd({
          winner: "draw" as any,
          winnerName: "Draw",
          pointsAwarded: 0,
          gameEndReason: "checkmate", // Will be handled as draw
          gameid: gameState.gameSessionId,
          winnerid: "",
        });
      }
    } catch (error) {
      console.error("Error checking game end conditions:", error);
    }
  };

  useEffect(() => {
    if (!isLoading && gameState.gameSessionId && !isReviewMode) {
      checkForGameEnd();
    }
  }, [localMoveHistory.length, gameState.currentTurn, isReviewMode]);



  // Handle board flip functionality
  const handleFlipBoard = () => {
    setFlipped(!flipped);
  };

  if (isLoading || !timers) {
    return <div className="text-center p-4">Loading game...</div>;
  }
  return (
    <>
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
                  isCurrentPlayer={currentPlayer === "black" && !isReviewMode}
                />
                <ChessTimer
                  timers={timers}
                  setTimers={setTimers}
                  currentPlayer={currentPlayer}
                  isGameOver={isGameOver || isReviewMode}
                  onTimeout={(color) => {
                    if (isReviewMode) return;

                    setTimers((prev) => prev && ({
                      ...prev,
                      white: { ...prev.white, active: false },
                      black: { ...prev.black, active: false },
                    }));

                    setIsGameOver(true);

                    const winner = color === "white" ? "black" : "white";
                    const winnerName = winner === "white" ? playerStats.white.name : playerStats.black.name;
                    const winnerId = winner === "white" ? gameState.userId1 : gameState.userId2;

                    const timeoutResult: GameResult = {
                      winner,
                      winnerName,
                      pointsAwarded: isRankedMatch ? 0 : 0, // Let backend handle points
                      gameEndReason: "timeout",
                      gameid: gameState.gameSessionId,
                      winnerid: winnerId,
                    };

                    handleGameEnd(timeoutResult);

                    toast({
                      title: "Game Over - Timeout!",
                      description: `${color === "white" ? playerStats.white.name : playerStats.black.name} ran out of time. ${winnerName} wins!`,
                      duration: 5000,
                    });
                  }}
                  gameId={gameId}
                  playerId={playerId}
                />
                <PlayerInfo
                  name={playerStats.white.name}
                  points={playerStats.white.points}
                  color="white"
                  isCurrentPlayer={currentPlayer === "white" && !isReviewMode}
                />
              </div>

              <ChessBoardPvP
                flipped={flipped}
                currentPlayer={currentPlayer}
                onMove={handlePlayerChange}
                onGameEnd={handleGameEnd}
                gameState={gameState}
                onGameStateChange={setGameState}
                playerColor={playerColor}
                timers={timers}
                onTimeUpdate={setTimers}
                onTimeout={(color) => {
                  if (isReviewMode) return;

                  const winner = color === "white" ? "black" : "white";
                  handleGameEnd({
                    winner,
                    winnerName: winner === "white" ? playerStats.white.name : playerStats.black.name,
                    pointsAwarded: isRankedMatch ? 0 : 0, // Let backend handle points
                    gameEndReason: "timeout",
                    gameid: gameState.gameSessionId,
                    winnerid: winner === "white" ? gameState.userId1 : gameState.userId2,
                  });
                }}
                player1Name={playerStats.white.name}
                player2Name={playerStats.black.name}
                onResetGame={resetGame}
                onMoveMade={handleMoveMade}
              />

              <GameControls
                playerColor={playerColor}
                onResign={(customResult?: GameResult) => {
                  if (isReviewMode) return;

                  if (customResult) {
                    handleGameEnd(customResult);
                  } else {
                    const winner = currentPlayer === "white" ? "black" : "white";
                    const resignationResult: GameResult = {
                      winner,
                      winnerName: winner === "white" ? playerStats.white.name : playerStats.black.name,
                      pointsAwarded: isRankedMatch ? 0 : 0, // Let backend handle points
                      gameEndReason: "resignation",
                      gameid: gameState.gameSessionId,
                      winnerid: winner === "white" ? gameState.userId1 : gameState.userId2,
                    };

                    handleGameEnd(resignationResult);
                  }
                }}
                onReset={resetGame}
                onFlipBoard={handleFlipBoard}
                gameState={gameState}
                currentPlayer={currentPlayer}
                isGameOver={isGameOver}
                gameResult={gameResult}
                isReviewMode={isReviewMode}
                isRankedMatch={isRankedMatch}
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
                    {isRankedMatch ? "Ranked Match" : "Normal Match"}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Current Turn</h4>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full ${currentPlayer === "white" ? "bg-white border border-black/20" : "bg-black"}`}></div>
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
                    {isRankedMatch ? "Streak-Based" : "0"}
                  </p>
                  {!isRankedMatch ? (
                    <p className="text-xs text-muted-foreground">
                      Casual match - no points awarded
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Win: 15 + streak bonus | Draw: 5 | Loss: -8 + streak penalty
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
                            const whiteMove = action;
                            const blackMove = localMoveHistory[index + 1];

                            acc.push(
                              <li key={whiteMove.sequenceNumber || index}>
                                {Math.floor(index / 2) + 1}. White: {moveToAlgebraicNotation(whiteMove)}{' '}
                                {blackMove ? `Black: ${moveToAlgebraicNotation(blackMove)}` : ''}
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
          onPlayAgain={() => navigate("/lobby")}
          onReviewGame={() => setIsModalOpen(false)}
          onBackToMenu={() => navigate("/")}
          isRankedMatch={isRankedMatch}
          totalPoints={totalPoints}
        />
      </div>
    </>
  );
};


export default ChessGameLayoutPvP;
