import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { memo } from "react";
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
import { useWebSocket } from "@/WebSocket/WebSocketContext.tsx";

const ensureClassicBoard = (board: any): Piece[][] => {
  if (!Array.isArray(board) || board.length !== 8 || !board.every((row: any) => Array.isArray(row) && row.length === 8)) {
    console.warn("Invalid board structure, using initialBoard");
    return initialBoard;
  }
  console.log("Raw server board:", JSON.stringify(board)); // Log raw server board
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
      console.warn(`Invalid cell at [${rowIdx}][${colIdx}]:`, cell);
      return null;
    })
  );
  console.log("Normalized board:", JSON.stringify(normalizedBoard)); // Log processed board
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
  const { client, isConnected } = useWebSocket();
  const [isInitialized, setIsInitialized] = useState(false);

  const currentPlayer = propCurrentPlayer || internalCurrentPlayer;
  const gameState23 = propGameState || internalGameState;

  const setGameStateValue = (newState: GameState) => {
    if (onGameStateChange) onGameStateChange(newState);
    else setInternalGameState(newState);
  };

  const setCurrentPlayerValue = (color: PieceColor) => {
    if (onMove) onMove(color);
    else setInternalCurrentPlayer(color);
    if (onPlayerChange) onPlayerChange(color);
  };

  useEffect(() => {
    if (!gameId || !playerId || !color || !opponentId) {
      toast({
        title: "Error",
        description: "Missing game data. Redirecting to lobby.",
        variant: "destructive",
      });
      navigate("/lobby");
      return;
    }

    if (!client || !isConnected) {
      console.log("WebSocket not connected yet, waiting...");
      return;
    }

    const subscriptions: { unsubscribe: () => void }[] = [];

    const initializeGame = async () => {
      try {
        const session = await gameSessionService.getGameSession(gameId);
        const classicBoard = ensureClassicBoard(session.board);
        console.log("Initial board from server:", classicBoard);
        setBoardHistory([classicBoard]);
        setCurrentMoveIndex(0);
        const hasPieces = classicBoard.some(row => row.some(cell => cell !== null));
        console.log("Board has pieces:", hasPieces);
        if (!hasPieces) {
          console.error("Board is empty!");
        }
        const initialGameState = {
          ...session.gameState,
          gameSessionId: gameId,
          userId1: session.whitePlayer.userId,
          userId2: session.blackPlayer?.userId || "",
        };
        setGameStateValue(initialGameState);
        setCurrentPlayerValue(session.gameState.currentTurn);
        setPlayerColor(color);

        subscriptions.push(
          client.subscribe(`/topic/game/${gameId}`, (message) => {
            const gameUpdate = JSON.parse(message.body);
            console.log("Game update:", gameUpdate);
            const serverBoard = ensureClassicBoard(gameUpdate.board);
            setBoardHistory((prev) => {
              const currentBoard = prev[currentMoveIndex];
              if (JSON.stringify(currentBoard) !== JSON.stringify(serverBoard)) {
                console.log("Board out of sync, updating...");
                return [...prev.slice(0, currentMoveIndex + 1), serverBoard];
              }
              return prev;
            });
            setCurrentMoveIndex((prev) => prev + 1);
            setGameStateValue({
              ...gameUpdate.gameState,
              gameSessionId: gameId,
              userId1: gameUpdate.whitePlayerId || playerId,
              userId2: gameUpdate.blackPlayerId || opponentId,
            });
            setCurrentPlayerValue(gameUpdate.gameState.currentTurn);
            if (gameUpdate.gameResult) {
              setGameResult(gameUpdate.gameResult);
              setShowGameEndModal(true);
              if (onGameEnd) onGameEnd(gameUpdate.gameResult);
            }
          })
        );

        subscriptions.push(
          client.subscribe(`/user/queue/game/${gameId}/move-validation`, (message) => {
            const validation = JSON.parse(message.body);
            if (!validation.valid) {
              toast({
                title: "Invalid Move",
                description: validation.message || "Move not allowed",
                variant: "destructive",
              });
              resetSelection();
            }
          })
        );

        setIsInitialized(true);
      } catch (error) {
        console.error("Failed to load game:", error);
        toast({
          title: "Error",
          description: "Failed to initialize game.",
          variant: "destructive",
        });
        navigate("/lobby");
      }
    };

    initializeGame();

    return () => {
      subscriptions.forEach((sub) => sub.unsubscribe());
    };
  }, [gameId, client, isConnected, navigate, playerId, color, opponentId]);

  useEffect(() => {
    // Log board state after boardHistory changes
    const hasPieces = boardHistory[0].some(row => row.some(cell => cell !== null));
    console.log("Board has pieces:", hasPieces);
    if (!hasPieces) {
      console.error("Board is empty!");
    }
  }, [boardHistory]);

  if (!isConnected || !isInitialized) {
    return <div>Loading game...</div>;
  }

  const resetSelection = () => {
    setSelectedPiece(null);
    setValidMoves([]);
  };

  const isSelectedPiece = (row: number, col: number): boolean =>
    selectedPiece?.row === row && selectedPiece?.col === col;

  const isValidMove = (row: number, col: number): boolean =>
    validMoves.some((move) => move.row === row && move.col === col);

  const handleSquareClick = async (row: number, col: number) => {
    console.log("Square clicked:", { row, col, playerColor, currentPlayer });
    if (isProcessingRef.current || gameState23.isCheckmate || gameState23.isDraw) {
      console.log("Processing or game over");
      return;
    }
    isProcessingRef.current = true;

    try {
      console.log("Checking turn:", { currentPlayer, playerColor });
      if (currentPlayer !== playerColor) {
        console.log("Not your turn");
        toast({
          title: "Not Your Turn",
          description: "Please wait for your opponent.",
          variant: "default",
        });
        resetSelection();
        return;
      }

      const currentBoard = boardHistory[currentMoveIndex];
      console.log("Full board state:", currentBoard);
      console.log("Board state at click:", currentBoard[row][col]);

      if (!selectedPiece) {
        const piece = currentBoard[row][col];
        console.log("Piece at position:", piece);
        if (!piece || piece.color !== playerColor) {
          console.log("Invalid selection:", !piece ? "No piece" : "Wrong color");
          toast({
            title: "Invalid Selection",
            description: "Please select your own piece.",
            variant: "destructive",
          });
          return;
        }
        setSelectedPiece({ row, col });
        const moves = await calculateValidMoves(
          { row, col },
          currentBoard,
          playerColor,
          gameState23.gameSessionId,
          "CLASSIC_MULTIPLAYER",
          8,
          true,
          gameState23.enPassantTarget
        );
        console.log("Valid moves:", moves);
        setValidMoves(moves);
        return;
      }

      const piece = currentBoard[row][col];
      if (piece && piece.color === playerColor) {
        setSelectedPiece({ row, col });
        const moves = await calculateValidMoves(
          { row, col },
          currentBoard,
          playerColor,
          gameState23.gameSessionId,
          "CLASSIC_MULTIPLAYER",
          8,
          true,
          gameState23.enPassantTarget
        );
        setValidMoves(moves);
        return;
      }

      if (!isValidMove(row, col)) {
        resetSelection();
        return;
      }

      const move = {
        from: { row: selectedPiece.row, col: selectedPiece.col },
        to: { row, col },
        playerId,
        gameId,
      };

      if (client && isConnected) {
        console.log("Sending move:", move);
        client.publish({
          destination: "/app/game/move",
          body: JSON.stringify(move),
        });
        const isCapture = !!currentBoard[row][col];
        const pieceType = currentBoard[selectedPiece.row][selectedPiece.col].type;
        if (onMoveMade) {
          onMoveMade({
            from: move.from,
            to: move.to,
            actionType: isCapture ? "capture" : "move",
            pieceType,
          });
        }
      } else {
        throw new Error("Disconnected from server");
      }

      resetSelection();
    } catch (error) {
      console.error("Move error:", error);
      toast({
        title: "Move Failed",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      resetSelection();
    } finally {
      isProcessingRef.current = false;
    }
  };

  const ChessSquareComponent = ChessSquare; // Removed memo to test if it affects behavior

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
              <ChessSquareComponent
                key={`${actualRowIndex}-${actualColIndex}`}
                row={actualRowIndex}
                col={actualColIndex}
                piece={piece}
                isLight={(actualRowIndex + actualColIndex) % 2 === 0}
                isSelected={isSelected}
                isValidMove={isValidMove(actualRowIndex, actualColIndex)}
                isCheck={gameState23.isCheck && piece?.type === "king" && piece?.color === gameState23.checkedPlayer}
                actualRowIndex={actualRowIndex}
                actualColIndex={actualColIndex}
                onClick={handleSquareClick}
                gameId={gameState23.gameSessionId}
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
      {gameState23.isCheck && !gameState23.isCheckmate && (
        <div className="mt-4 p-2 bg-red-100 text-red-800 rounded-md">
          {gameState23.checkedPlayer === playerColor
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
