import React, { useState, useEffect, useRef } from "react";
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

// Normalize board state received from the server
const ensureClassicBoard = (board: any): Piece[][] => {
  if (!Array.isArray(board) || board.length !== 8 || !board.every((row: any) => Array.isArray(row) && row.length === 8)) {
    console.warn("Invalid board structure received from server, reverting to initialBoard");
    return initialBoard;
  }
  console.log("[DEBUG] Raw server board:", JSON.stringify(board));
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
      console.warn(`[DEBUG] Invalid cell at [${rowIdx}][${colIdx}]:`, cell);
      return null;
    })
  );
  console.log("[DEBUG] Normalized board:", JSON.stringify(normalizedBoard));
  return normalizedBoard;
};

const ChessBoardPvP: React.FC<ChessBoardProps> = ({
                                                    flipped = false,
                                                    onPlayerChange,
                                                    timers,
                                                    onTimeUpdate,
                                                    onTimeout,
                                                    player1Name,
                                                    player2Name,
                                                    onResetGame,
                                                    currentPlayer: propCurrentPlayer,
                                                    onMove,
                                                    onGameEnd,
                                                    gameState: propGameState,
                                                    onGameStateChange,
                                                    onMoveMade,
                                                    playerColor: propPlayerColor,
                                                  }) => {
  const { gameId } = useParams<{ gameId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { playerId, color, opponentId } = location.state || {};
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
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [showGameEndModal, setShowGameEndModal] = useState(false);
  const [playerColor, setPlayerColor] = useState<PieceColor>(color || "white");
  const isProcessingRef = useRef(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const currentPlayer = propCurrentPlayer || internalCurrentPlayer;
  const gameState = propGameState || internalGameState;

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
          userId2: session.blackPlayer?.userId || "",
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

        // Only update if the board actually changed
        const currentBoard = boardHistory[currentMoveIndex];
        const boardChanged = JSON.stringify(serverBoard) !== JSON.stringify(currentBoard);

        if (boardChanged) {
          console.log("[DEBUG] Board changed, updating...");
          setBoardHistory([serverBoard]);
          setCurrentMoveIndex(0);
          setGameStateValue(session.gameState);
          setCurrentPlayerValue(session.gameState.currentTurn);

          // Reset selection when board updates
          resetSelection();

          toast({
            title: "Board Updated",
            description: `${session.gameState.currentTurn === playerColor ? 'Your turn' : 'Opponent moved'}`,
            duration: 2000,
          });
        }
      } catch (error) {
        console.error("[ERROR] Failed to poll game state:", error);
      }
    }, 2000); // Poll every 2 seconds

    return () => clearInterval(pollInterval);
  }, [isInitialized, gameId, boardHistory, currentMoveIndex, playerColor]);

  if (!isInitialized) {
    return <div>Loading game...</div>;
  }

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
    if (isProcessingRef.current || gameState.isCheckmate || gameState.isDraw) {
      console.log("[DEBUG] Click ignored: Processing or game over");
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
          setBoardHistory([serverBoard]);
          setCurrentMoveIndex(0);
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
