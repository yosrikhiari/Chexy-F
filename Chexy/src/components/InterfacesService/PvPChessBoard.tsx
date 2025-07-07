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
  return board.map((row: any[]) =>
    row.map((cell: any) => {
      if (!cell || typeof cell.type !== "string" || typeof cell.color !== "string") return null;
      const normalizedType = cell.type.toLowerCase() as PieceType;
      const normalizedColor = cell.color.toLowerCase() as PieceColor;
      if (["king", "queen", "rook", "bishop", "knight", "pawn"].includes(normalizedType) &&
        ["white", "black"].includes(normalizedColor)) {
        return { type: normalizedType, color: normalizedColor, hasMoved: cell.hasMoved ?? false };
      }
      return null;
    })
  );
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

  const currentPlayer = propCurrentPlayer || internalCurrentPlayer;
  const gameState = propGameState || internalGameState;

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
    console.log("ChessBoardPvP mounted with gameId:", gameId, "state:", location.state);
    if (!gameId || !playerId || !color || !opponentId) {
      toast({
        title: "Error",
        description: "Missing game data. Redirecting to lobby.",
        variant: "destructive",
      });
      navigate("/lobby");
      return;
    }

    // Add WebSocket connection check
    if (!client || !isConnected) {
      console.log("WebSocket not connected yet, waiting...");
      return;
    }

    const subscriptions: { unsubscribe: () => void }[] = [];

    subscriptions.push(
      client.subscribe(`/topic/game/${gameId}`, (message) => {
        try {
          const gameUpdate = JSON.parse(message.body);
          console.log("Received game update:", gameUpdate);

          const newBoard = ensureClassicBoard(gameUpdate.board);
          setBoardHistory((prev) => [...prev.slice(0, currentMoveIndex + 1), newBoard]);
          setCurrentMoveIndex((prev) => prev + 1);

          const newGameState = {
            ...gameUpdate.gameState,
            gameSessionId: gameId,
            userId1: gameUpdate.whitePlayerId || playerId,
            userId2: gameUpdate.blackPlayerId || opponentId,
          };
          setGameStateValue(newGameState);
          setCurrentPlayerValue(newGameState.currentTurn);

          if (gameUpdate.gameResult) {
            setGameResult(gameUpdate.gameResult);
            setShowGameEndModal(true);
            if (onGameEnd) onGameEnd(gameUpdate.gameResult);
          }

          if (gameUpdate.timers && onTimeUpdate) {
            onTimeUpdate(gameUpdate.timers);
          }
        } catch (error) {
          console.error("Error processing game update:", error);
          toast({
            title: "Error",
            description: "Failed to process game update.",
            variant: "destructive",
          });
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

    const initializeGame = async () => {
      try {
        const session = await gameSessionService.getGameSession(gameId);
        const classicBoard = ensureClassicBoard(session.board);
        setBoardHistory([classicBoard]);
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
  }, [gameId, client, isConnected, navigate]);

  const resetSelection = () => {
    setSelectedPiece(null);
    setValidMoves([]);
  };

  const isSelectedPiece = (row: number, col: number): boolean =>
    selectedPiece?.row === row && selectedPiece?.col === col;

  const isValidMove = (row: number, col: number): boolean =>
    validMoves.some((move) => move.row === row && move.col === col);

  const handleSquareClick = async (row: number, col: number) => {
    if (isProcessingRef.current || gameState.isCheckmate || gameState.isDraw) return;
    isProcessingRef.current = true;

    try {
      if (currentPlayer !== playerColor) {
        toast({
          title: "Not Your Turn",
          description: "Please wait for your opponent.",
          variant: "default",
        });
        resetSelection();
        return;
      }

      const currentBoard = boardHistory[currentMoveIndex];

      if (!selectedPiece) {
        const piece = currentBoard[row][col];
        if (!piece || piece.color !== playerColor) {
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
          gameState.gameSessionId,
          "CLASSIC_MULTIPLAYER",
          8,
          true,
          gameState.enPassantTarget
        );
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
          gameState.gameSessionId,
          "CLASSIC_MULTIPLAYER",
          8,
          true,
          gameState.enPassantTarget
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

      // Update this condition to check both client and isConnected
      if (client && isConnected) {
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

  const renderBoard = () => {
    const displayBoard = boardHistory[currentMoveIndex];
    const boardToRender = flipped ? [...displayBoard].reverse().map((row) => [...row].reverse()) : displayBoard;

    return boardToRender.map((row, rowIndex) => {
      const actualRowIndex = flipped ? 7 - rowIndex : rowIndex;
      return (
        <div key={rowIndex} className="flex">
          {row.map((piece, colIndex) => {
            const actualColIndex = flipped ? 7 - colIndex : colIndex;
            const isLight = (actualRowIndex + actualColIndex) % 2 === 0;
            const isSelected = isSelectedPiece(actualRowIndex, actualColIndex);
            const isValidMoveSquare = isValidMove(actualRowIndex, actualColIndex);
            const isCheck = gameState.isCheck && piece?.type === "king" && piece?.color === gameState.checkedPlayer;

            return (
              <ChessSquare
                key={`${actualRowIndex}-${actualColIndex}`}
                row={actualRowIndex}
                col={actualColIndex}
                piece={piece}
                isLight={isLight}
                isSelected={isSelected}
                isValidMove={isValidMoveSquare}
                isCheck={isCheck}
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

export default memo(ChessBoardPvP);
