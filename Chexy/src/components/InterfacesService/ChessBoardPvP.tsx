import React, {useState, useEffect, useRef, useCallback} from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "@/components/ui/use-toast.tsx";
import {
  PieceColor,
  BoardPosition,
  GameState,
  GameResult,
  Piece,
  PieceType,
} from "@/Interfaces/types/chess.ts";
import ChessSquare from "./ChessSquare.tsx";
import GameEndModal from "./GameEndModal.tsx";
import { initialBoard } from "@/utils/chessConstants.ts";
import { calculateValidMoves } from "@/utils/chessUtils.ts";
import { ChessBoardProps } from "@/Interfaces/ChessBoardProps.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { gameService } from "@/services/GameService.ts";

// Storage helpers to avoid localStorage quota errors
const MAX_HISTORY_SNAPSHOTS = 80;
const REDUCED_HISTORY_SNAPSHOTS = 40;

const getBoardHistoryKey = (gameId: string) => `boardHistory_${gameId}`;

const clearOtherBoardHistories = (currentKey: string) => {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) as string;
      if (key && key.startsWith("boardHistory_") && key !== currentKey) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {}
};

const safeSaveBoardHistory = (gameId: string, history: any[][][]) => {
  const key = getBoardHistoryKey(gameId);
  const trySet = (h: any[][][]) => {
    try {
      localStorage.setItem(key, JSON.stringify(h));
      return true;
    } catch (e: any) {
      if (e && (e.name === "QuotaExceededError" || (typeof e.message === "string" && e.message.includes("quota")))) {
        return false;
      }
      // Non-quota errors: swallow but stop retrying
      return true;
    }
  };

  // 1) Try with current size
  if (trySet(history)) return;
  // 2) Prune to MAX_HISTORY_SNAPSHOTS
  const pruned = history.slice(-MAX_HISTORY_SNAPSHOTS);
  if (trySet(pruned)) return;
  // 3) Prune harder
  const prunedMore = history.slice(-REDUCED_HISTORY_SNAPSHOTS);
  if (trySet(prunedMore)) return;
  // 4) Free space by clearing other game histories and retry
  clearOtherBoardHistories(key);
  if (trySet(prunedMore)) return;
  // 5) Fallback to sessionStorage
  try {
    sessionStorage.setItem(key, JSON.stringify(prunedMore));
  } catch {}
};

// Normalize board state received from the server
const ensureClassicBoard = (board: any): Piece[][] => {
  if (!Array.isArray(board) || board.length !== 8 || !board.every((row: any) => Array.isArray(row) && row.length === 8)) {
    console.warn("Invalid board structure received from server, reverting to initialBoard");
    return initialBoard;
  }
  const normalizedBoard = board.map((row: any[], rowIdx: number) =>
    row.map((cell: any, colIdx: number) => {
      if (!cell) return null;
      const type = cell.type || cell.pieceType;
      const color = cell.color || cell.pieceColor;
      if (typeof type === "string" && typeof color === "string") {
        const normalizedType = type.toLowerCase() as PieceType;
        const normalizedColor = color.toLowerCase() as PieceColor;
        if (["king", "queen", "rook", "bishop", "knight", "pawn"].includes(normalizedType) &&
          ["white", "black"].includes(normalizedColor)) {
          return { type: normalizedType, color: normalizedColor, hasMoved: cell.hasMoved ?? false };
        }
      }
      return null;
    })
  );
  return normalizedBoard;
};

const ChessBoardPvP: React.FC<ChessBoardProps> = ({
                                                    flipped = false,
                                                    onPlayerChange,
                                                    player1Name,
                                                    player2Name,
                                                    currentPlayer: propCurrentPlayer,
                                                    onMove,
                                                    gameState: propGameState,
                                                    onGameStateChange,
                                                    onMoveMade,
                                                    isSpectateMode,
                                                  }) => {
  const { gameId } = useParams<{ gameId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { playerId, color, opponentId } = location.state || {};




  // ALL STATE DECLARATIONS
  const [boardHistory, setBoardHistory] = useState<Piece[][][]>([initialBoard]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [selectedPiece, setSelectedPiece] = useState<BoardPosition | null>(null);
  const [validMoves, setValidMoves] = useState<BoardPosition[]>([]);
  const [internalCurrentPlayer, setInternalCurrentPlayer] = useState<PieceColor>("white");
  const [internalGameState, setInternalGameState] = useState<GameState>({
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

  const [isLocalGameOver] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [showGameEndModal, setShowGameEndModal] = useState(false);
  const [playerColor, setPlayerColor] = useState<PieceColor>(color || "white");
  const isProcessingRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const currentPlayer = propCurrentPlayer || internalCurrentPlayer;
  const gameState = propGameState || internalGameState;
  const isGameActuallyOver = useCallback(() => {
    return (
      isLocalGameOver ||
      gameState?.isCheckmate ||
      gameState?.isDraw ||
      gameResult !== null
    );
  }, [isLocalGameOver, gameState, gameResult]);
  const setGameStateValue = (newState: GameState) => {
    console.log("[DEBUG] Updating game state:", newState);
    if (onGameStateChange) onGameStateChange(newState);
    else setInternalGameState(newState);
  };

  const setCurrentPlayerValue = (color: PieceColor) => {
    console.log("[DEBUG] Setting current player:", color);
    if (onMove) onMove(color);
    else setInternalCurrentPlayer(color);
    if (onPlayerChange) onPlayerChange(color);
  };

  // Initialize game
  useEffect(() => {
    if (!gameId || !playerId || !color || !opponentId) {
      console.error("[ERROR] Missing required game data:", { gameId, playerId, color, opponentId });
      toast({
        title: "Error",
        description: "Missing game data. Redirecting to lobby.",
        variant: "destructive",
      });
      navigate("/lobby");
      return;
    }

    const initializeGame = async () => {
      try {
        console.log("[DEBUG] Initializing game for gameId:", gameId);
        const session = await gameSessionService.getGameSession(gameId);
        const serverBoard = ensureClassicBoard(session.board);
        console.log("[DEBUG] Initial server board:", serverBoard);

        setBoardHistory([serverBoard]);
        setCurrentMoveIndex(0);

        const initialGameState = {
          ...session.gameState,
          gameSessionId: gameId,
          userId1: session.whitePlayer.userId,
          userId2: (Array.isArray(session.blackPlayer) ? session.blackPlayer[0]?.userId : (session as any).blackPlayer?.userId) || "",
        };
        setGameStateValue(initialGameState);
        setCurrentPlayerValue(session.gameState.currentTurn);
        setPlayerColor(color);

        setIsInitialized(true);
        console.log("[DEBUG] Game initialization completed");
      } catch (error) {
        console.error("[ERROR] Failed to initialize game:", error);
        toast({
          title: "Error",
          description: "Failed to initialize game.",
          variant: "destructive",
        });
        navigate("/lobby");
      }
    };

    initializeGame();
  }, [gameId, navigate, playerId, color, opponentId]);

  // Auto-refresh game state every 2 seconds to get opponent's moves
  useEffect(() => {
    if (!isInitialized || !gameId) return;

    const pollInterval = setInterval(async () => {
      try {
        const session = await gameSessionService.getGameSession(gameId);
        const serverBoard = ensureClassicBoard(session.board);

        // Only update if the board actually changed and we're at the latest move
        const currentBoard = boardHistory[boardHistory.length - 1];
        const boardChanged = JSON.stringify(serverBoard) !== JSON.stringify(currentBoard);

        if (boardChanged) {
          console.log("[DEBUG] Board changed, updating history...");
          setBoardHistory(prev => {
            const extended = [...prev, serverBoard];
            const pruned = extended.slice(-MAX_HISTORY_SNAPSHOTS);
            // Safe persist with pruning and fallbacks
            safeSaveBoardHistory(gameId!, pruned);
            return pruned;
          });

          // Only auto-advance to latest move if we were already at the latest
          setCurrentMoveIndex(prev => {
            if (prev === boardHistory.length - 1) {
              return boardHistory.length; // Will be the new latest after boardHistory updates
            }
            return prev; // Keep current position if reviewing
          });

          setGameStateValue(session.gameState);
          setCurrentPlayerValue(session.gameState.currentTurn);

          // Reset selection when board updates from opponent move
          if (selectedPiece && currentMoveIndex === boardHistory.length - 1) {
            setSelectedPiece(null);
            setValidMoves([]);
          }

          toast({
            title: "Board Updated",
            description: `${session.gameState.currentTurn === playerColor ? 'Your turn' : 'Opponent moved'}`,
            duration: 2000,
          });
        }
      } catch (error) {
        console.error("[ERROR] Failed to poll game state:", error);
      }
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [isInitialized, gameId, boardHistory, currentMoveIndex, playerColor, selectedPiece]);

  // Load saved board history on initialization
  useEffect(() => {
    if (!gameId || !isInitialized) return;

    const savedHistory = localStorage.getItem(`boardHistory_${gameId}`);
    if (savedHistory) {
      try {
        const parsedHistory = JSON.parse(savedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.length > 0) {
          setBoardHistory(parsedHistory);
          setCurrentMoveIndex(parsedHistory.length - 1);
        }
      } catch (error) {
        console.error("[ERROR] Failed to parse saved board history:", error);
      }
    }
  }, [gameId, isInitialized]);

  const resetSelection = () => {
    console.log("[DEBUG] Resetting selection");
    setSelectedPiece(null);
    setValidMoves([]);
  };

  const isSelectedPiece = (row: number, col: number): boolean =>
    selectedPiece?.row === row && selectedPiece?.col === col;

  const isValidMove = (row: number, col: number): boolean =>
    validMoves.some((move) => move.row === row && move.col === col);

  const handleSquareClick = async (row: number, col: number) => {
    if (isSpectateMode) {
      return;
    }
    if (isGameActuallyOver()) {
      console.log("[DEBUG] Click ignored: Game is over");
      return;
    }

    if (isProcessingRef.current || gameState.isCheckmate || gameState.isDraw) {
      console.log("[DEBUG] Click ignored: Processing or game over");
      return;
    }

    // Check if we're reviewing moves (not at the latest position)
    if (currentMoveIndex < boardHistory.length - 1) {
      toast({
        title: "Review Mode",
        description: "Please go to the latest move to continue playing.",
        variant: "default",
      });
      return;
    }

    console.log("[DEBUG] Handling square click:", { row, col, playerColor, currentPlayer });

    // Check if it's the player's turn
    if (currentPlayer !== playerColor) {
      console.log("[DEBUG] Not your turn");
      toast({
        title: "Not Your Turn",
        description: "Please wait for your opponent.",
        variant: "default",
      });
      resetSelection();
      return;
    }

    const currentBoard = boardHistory[currentMoveIndex];
    console.log("[DEBUG] Current board state:", currentBoard);

    // If no piece is selected, select a piece
    if (!selectedPiece) {
      const piece = currentBoard[row][col];
      console.log("[DEBUG] Selected piece:", piece);
      if (!piece || piece.color !== playerColor) {
        console.log("[DEBUG] Invalid piece selection");
        toast({
          title: "Invalid Selection",
          description: "Please select your own piece.",
          variant: "destructive",
        });
        return;
      }
      setSelectedPiece({ row, col });

      try {
        const moves = await calculateValidMoves(
          { row, col },
          currentBoard,
          playerColor,
          gameState.gameSessionId,
          "CLASSIC_MULTIPLAYER",
          8,
          true,
          gameState.enPassantTarget
        );
        console.log("[DEBUG] Calculated valid moves:", moves);
        setValidMoves(moves);
      } catch (error) {
        console.error("[ERROR] Failed to calculate valid moves:", error);
        setValidMoves([]);
      }
      return;
    }

    // If clicking on own piece, re-select it
    const piece = currentBoard[row][col];
    if (piece && piece.color === playerColor) {
      console.log("[DEBUG] Re-selecting own piece");
      setSelectedPiece({ row, col });
      try {
        const moves = await calculateValidMoves(
          { row, col },
          currentBoard,
          playerColor,
          gameState.gameSessionId,
          "CLASSIC_MULTIPLAYER",
          8,
          true,
          gameState.enPassantTarget
        );
        setValidMoves(moves);
      } catch (error) {
        console.error("[ERROR] Failed to calculate valid moves:", error);
        setValidMoves([]);
      }
      return;
    }

    // Check if the move is valid
    if (!isValidMove(row, col)) {
      console.log("[DEBUG] Invalid move target");
      resetSelection();
      return;
    }

    // Set processing flag to prevent multiple moves
    isProcessingRef.current = true;

    try {
      const move = {
        from: { row: selectedPiece.row, col: selectedPiece.col },
        to: { row, col }
      };

      console.log("[DEBUG] Executing move via HTTP:", move);

      // Execute move via HTTP
      await gameService.executeMove(gameId!, move);

      // Trigger onMoveMade callback
      const isCapture = !!currentBoard[row][col];
      const pieceType = currentBoard[selectedPiece.row][selectedPiece.col].type;
      if (onMoveMade) {
        console.log("[DEBUG] Triggering onMoveMade callback");
        onMoveMade({
          from: { row: selectedPiece.row, col: selectedPiece.col },
          to: { row, col },
          actionType: isCapture ? "capture" : "move",
          pieceType,
        });
      }

      // Show success feedback
      toast({
        title: "Move Executed",
        description: "Waiting for opponent...",
        duration: 2000,
      });

      // Reset selection and processing flag
      resetSelection();
      isProcessingRef.current = false;

      // Manually refresh the board state immediately
          setTimeout(async () => {
        try {
          const session = await gameSessionService.getGameSession(gameId!);
          const serverBoard = ensureClassicBoard(session.board);
              setBoardHistory(prev => {
                const extended = [...prev, serverBoard];
                const pruned = extended.slice(-MAX_HISTORY_SNAPSHOTS);
                safeSaveBoardHistory(gameId!, pruned);
                return pruned;
              });
          setCurrentMoveIndex(prev => prev + 1);
          setGameStateValue(session.gameState);
          setCurrentPlayerValue(session.gameState.currentTurn);
        } catch (error) {
          console.error("[ERROR] Failed to refresh after move:", error);
        }
      }, 500);

    } catch (error) {
      console.error("[ERROR] Move execution failed:", error);
      toast({
        title: "Move Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      resetSelection();
      isProcessingRef.current = false;
    }
  };

  useEffect(() => {
    if (!isInitialized || !gameState) return;

    if (gameState.isCheckmate || gameState.isDraw) {
      let winner: PieceColor;
      let winnerName: string;
      let gameEndReason: "checkmate" | "timeout" | "resignation" | "draw";

      if (gameState.isCheckmate) {
        winner = gameState.checkedPlayer === "white" ? "black" : "white";
        winnerName = winner === "white" ? (player1Name || "White") : (player2Name || "Black");
        gameEndReason = "checkmate";
      } else {
        winner = "white"; // Placeholder
        winnerName = "Draw";
        gameEndReason = "draw";
      }

      const gameResult: GameResult = {
        winner: gameState.isDraw ? "draw" : winner,
        winnerName: gameState.isDraw ? "Draw" : winnerName,
        pointsAwarded: 0,
        gameEndReason: gameState.isDraw ? "draw" : gameEndReason,
        gameid: gameState.gameSessionId,
        winnerid: gameState.isDraw ? "" : (winner === "white" ? gameState.userId1 : gameState.userId2),
      };

      // Remove onGameEnd call to prevent duplicate point calculations
      // The parent component (ChessGameLayoutPvP) will handle game end logic
      setGameResult(gameResult);
      setShowGameEndModal(true);
    }
      }, [gameState?.isCheckmate, gameState?.isDraw, isInitialized, player1Name, player2Name, gameState?.gameSessionId, gameState?.userId1, gameState?.userId2, gameState?.checkedPlayer]);

  // NOW EARLY RETURNS CAN GO HERE
  if (!isInitialized) {
    return <div>Loading game...</div>;
  }

  const renderBoard = () => {
    const displayBoard = boardHistory[currentMoveIndex];
    const boardToRender = flipped ? [...displayBoard].reverse().map((row) => [...row].reverse()) : displayBoard;

    return boardToRender.map((row, rowIndex) => {
      const actualRowIndex = flipped ? 7 - rowIndex : rowIndex;
      return (
        <div key={rowIndex} className="flex">
          {row.map((piece, colIndex) => {
            const actualColIndex = flipped ? 7 - colIndex : colIndex;
            const isSelected = isSelectedPiece(actualRowIndex, actualColIndex);
            return (
              <ChessSquare
                key={`${actualRowIndex}-${actualColIndex}`}
                row={actualRowIndex}
                col={actualColIndex}
                piece={piece}
                isLight={(actualRowIndex + actualColIndex) % 2 === 0}
                isSelected={isSelected}
                isValidMove={isValidMove(actualRowIndex, actualColIndex)}
                isCheck={gameState.isCheck && piece?.type === "king" && piece?.color === gameState.checkedPlayer}
                actualRowIndex={actualRowIndex}
                actualColIndex={actualColIndex}
                onClick={handleSquareClick}
                gameId={gameState.gameSessionId}
                gameMode="CLASSIC_MULTIPLAYER"
                playerId={playerId}
              />
            );
          })}
        </div>
      );
    });
  };

  return (
    <div className="flex flex-col items-center">
      <div className="rounded-md overflow-hidden shadow-lg border border-accent/20">
        {renderBoard()}
      </div>

      {/* Navigation buttons - copied from ChessBoard */}
      <div className="flex justify-center space-x-4 mt-4">
        <button
          onClick={() => {
            setCurrentMoveIndex(prev => {
              const newIndex = Math.max(0, prev - 1);
              return newIndex;
            });
          }}
          disabled={currentMoveIndex === 0}
          className="p-2 rounded-full text-primary hover:bg-primary/10 disabled:opacity-50"
          aria-label="Previous move"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <button
          onClick={() => {
            setCurrentMoveIndex(prev => {
              const newIndex = Math.min(boardHistory.length - 1, prev + 1);
              return newIndex;
            });
          }}
          disabled={currentMoveIndex === boardHistory.length - 1}
          className="p-2 rounded-full text-primary hover:bg-primary/10 disabled:opacity-50"
          aria-label="Next move"
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="w-6 h-6">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {gameState.isCheck && !gameState.isCheckmate && (
        <div className="mt-4 p-2 bg-red-100 text-red-800 rounded-md">
          {gameState.checkedPlayer === playerColor
            ? "Your king is in check! You must respond."
            : "Opponent's king is in check."}
        </div>
      )}

      <GameEndModal
        open={showGameEndModal}
        gameResult={gameResult}
        onClose={() => setShowGameEndModal(false)}
        onPlayAgain={() => {
          setShowGameEndModal(false);
          navigate("/lobby");
        }}
        onReviewGame={() => setShowGameEndModal(false)}
        onBackToMenu={() => navigate("/")}
      />
    </div>
  );
};

export default ChessBoardPvP;
