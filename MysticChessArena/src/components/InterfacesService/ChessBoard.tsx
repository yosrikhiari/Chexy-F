import React, { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast.tsx";
import {
  PieceColor,
  BoardPosition,
  GameTimers,
  GameState,
  GameResult,
  Piece,
  PieceType
} from "@/Interfaces/types/chess.ts";
import ChessSquare from "./ChessSquare.tsx";
import GameEndModal from "./GameEndModal.tsx";
import { initialBoard } from "@/utils/chessConstants.ts";
import { calculateValidMoves } from "@/utils/chessUtils.ts";
import { ChessBoardProps } from "@/Interfaces/ChessBoardProps.ts";
import { GameSession } from "@/Interfaces/types/GameSession.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { chessGameService } from "@/services/ChessGameService.ts";
import { gameHistoryService } from "@/services/GameHistoryService.ts";
import { gameService } from "@/services/GameService.ts";
import {realtimeService} from "@/services/RealtimeService.ts";
import {GameMode} from "@/Interfaces/enums/GameMode.ts";

// Utility to deep clone the board to prevent direct mutations
const cloneBoard = (board: Piece[][]): Piece[][] =>
  board.map(row => row.map(piece => (piece ? { ...piece } : null)));

// Ensure board is always a valid Piece[][] for classic chess
const ensureClassicBoard = (board: any): Piece[][] => {
  console.log('Raw board from backend:', JSON.stringify(board, null, 2));

  if (!Array.isArray(board) || board.length !== 8 || !board.every((row: any) => Array.isArray(row) && row.length === 8)) {
    console.warn('Invalid board structure, using initialBoard:', board);
    return initialBoard;
  }

  const normalizedBoard = board.map((row: any[], rowIndex: number) =>
    row.map((cell: any, colIndex: number) => {
      if ([0, 1, 6, 7].includes(rowIndex) && !cell) {
        console.warn(`Unexpected null at [${rowIndex}][${colIndex}] in piece row`);
      }
      if (cell && typeof cell.type === 'string' && typeof cell.color === 'string') {
        // Normalize both type and color to lowercase
        const normalizedType = cell.type.toLowerCase() as PieceType;
        const normalizedColor = cell.color.toLowerCase() as PieceColor;

        if (
          ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'].includes(normalizedType) &&
          ['white', 'black'].includes(normalizedColor)
        ) {
          const normalizedPiece = {
            ...cell,
            type: normalizedType,
            color: normalizedColor,
            hasMoved: cell.hasMoved ?? false,
            enPassantTarget: cell.enPassantTarget ?? false,
          };
          console.log(`Normalized piece at [${rowIndex}][${colIndex}]:`, normalizedPiece);
          return normalizedPiece;
        }
        console.warn(`Invalid piece type or color at [${rowIndex}][${colIndex}]:`, cell);
      } else if (rowIndex >= 2 && rowIndex <= 5) {
        return null;
      } else {
        console.warn(`Missing or invalid type/color at [${rowIndex}][${colIndex}]:`, cell);
      }
      return null;
    })
  );

  console.log('Normalized board:', JSON.stringify(normalizedBoard, null, 2));
  return normalizedBoard;
};

const ChessBoard = ({
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
                      gameState: propGameState,
                      onGameStateChange,
                    }: ChessBoardProps) => {
  const [board, setBoard] = useState<Piece[][]>(initialBoard);
  const [selectedPiece, setSelectedPiece] = useState<BoardPosition | null>(null);
  const [validMoves, setValidMoves] = useState<BoardPosition[]>([]);
  const [internalCurrentPlayer, setInternalCurrentPlayer] = useState<PieceColor>("white");
  const [internalGameState, setInternalGameState] = useState<GameState>({
    gameSessionId: "",
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
  const [isLoadingMove, setIsLoadingMove] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>("CLASSIC_MULTIPLAYER");

  const currentPlayer = propCurrentPlayer || internalCurrentPlayer;
  const gameState = propGameState || internalGameState;

  const setGameStateValue = (newState: GameState) => {
    if (onGameStateChange) {
      onGameStateChange(newState);
    } else {
      setInternalGameState(newState);
    }
  };

  const setCurrentPlayerValue = (color: PieceColor) => {
    if (onMove) {
      onMove(color);
    } else {
      setInternalCurrentPlayer(color);
    }
    if (onPlayerChange) {
      onPlayerChange(color);
    }
  };

  // Fetch and sync game state from server
  useEffect(() => {
    const fetchGameState = async () => {
      if (!propGameState?.gameSessionId) {
        console.error("Missing gameSessionId");
        return;
      }

      try {
        const gameSession: GameSession = await gameSessionService.getGameSession(propGameState.gameSessionId);
        setGameMode(gameSession.gameMode);
        if (gameSession.gameMode !== "CLASSIC_MULTIPLAYER" && gameSession.gameMode !== "CLASSIC_SINGLE_PLAYER") {
          toast({
            title: "Error",
            description: `This component supports only CLASSIC_MULTIPLAYER or CLASSIC_SINGLE_PLAYER mode. Current mode: ${gameSession.gameMode}`,
            variant: "destructive",
          });
          setBoard(initialBoard);
          return;
        }

        const classicBoard = ensureClassicBoard(gameSession.board);
        setBoard(classicBoard);
        setGameStateValue({
          ...gameSession.gameState,
          gameSessionId: propGameState.gameSessionId,
          userId1: propGameState.userId1,
          userId2: propGameState.userId2,
        });
        setCurrentPlayerValue(gameSession.gameState.currentTurn);
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to fetch game state from server.",
          variant: "destructive",
        });
        setBoard(initialBoard);
      }
    };
    fetchGameState();
  }, [propGameState?.gameSessionId]);

  // Check game status (check/checkmate)
  useEffect(() => {
    const checkGameStatus = async () => {
      if (!gameState.gameSessionId) return;

      try {
        const whiteInCheck = await chessGameService.isCheck(gameState.gameSessionId, "white");
        const blackInCheck = await chessGameService.isCheck(gameState.gameSessionId, "black");
        let checkedPlayer: PieceColor | null = null;
        if (whiteInCheck) checkedPlayer = "white";
        else if (blackInCheck) checkedPlayer = "black";

        let isCheckmateState = false;
        if (checkedPlayer) {
          isCheckmateState = await chessGameService.isCheckmate(gameState.gameSessionId, checkedPlayer);
        }

        setGameStateValue({
          ...gameState,
          isCheck: whiteInCheck || blackInCheck,
          isCheckmate: isCheckmateState,
          checkedPlayer,
        });

        if (checkedPlayer && isCheckmateState) {
          const winningPlayer = checkedPlayer === "white" ? "black" : "white";
          const winnerName = winningPlayer === "white" ? player1Name : player2Name;
          const basePoints = 100;
          const timeBonus = timers ? Math.floor(timers[winningPlayer].timeLeft / 60) * 5 : 0;
          const pointsAwarded = basePoints + timeBonus;

          const gameResultData: GameResult = {
            winner: winningPlayer,
            winnerName: winnerName || "Unknown",
            pointsAwarded,
            gameEndReason: "checkmate",
            gameid: gameState.gameSessionId,
            winnerid: winningPlayer === "white" ? gameState.userId1 : gameState.userId2,
          };

          setGameResult(gameResultData);
          setShowGameEndModal(true);

          toast({
            title: "Checkmate!",
            description: `${winnerName} (${winningPlayer}) wins!`,
            variant: "default",
          });

          await gameHistoryService.completeGameHistory(gameState.gameSessionId, gameResultData);
          await gameSessionService.endGame(gameState.gameSessionId, gameResultData.winnerid);
        } else if (checkedPlayer) {
          const playerName = checkedPlayer === "white" ? player1Name : player2Name;
          toast({
            title: "Check!",
            description: `${playerName}'s king is in check!`,
            variant: "destructive",
          });
        }
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to check game status.",
          variant: "destructive",
        });
      }
    };
    checkGameStatus();
  }, [board, gameState.gameSessionId]);

  // Timer management
  useEffect(() => {
    if (!timers || gameMode === "SINGLE_PLAYER_RPG") return;

    const timerInterval = setInterval(() => {
      if (timers[currentPlayer]?.active && timers[currentPlayer]?.timeLeft > 0) {
        const updatedTimers = {
          ...timers,
          [currentPlayer]: {
            ...timers[currentPlayer],
            timeLeft: timers[currentPlayer].timeLeft - 1,
          },
        };

        if (onTimeUpdate) {
          onTimeUpdate(updatedTimers);
        }

        if (updatedTimers[currentPlayer].timeLeft === 0 && onTimeout) {
          const winningPlayer = currentPlayer === "white" ? "black" : "white";
          const winnerName = winningPlayer === "white" ? player1Name : player2Name;
          const pointsAwarded = 75;

          const gameResultData: GameResult = {
            winner: winningPlayer,
            winnerName: winnerName || "Unknown",
            pointsAwarded,
            gameEndReason: "timeout",
            gameid: gameState.gameSessionId,
            winnerid: winningPlayer === "white" ? gameState.userId1 : gameState.userId2,
          };

          setGameResult(gameResultData);
          setShowGameEndModal(true);
          onTimeout(currentPlayer);

          Promise.all([
            gameHistoryService.completeGameHistory(gameState.gameSessionId, gameResultData),
            gameSessionService.endGame(gameState.gameSessionId, gameResultData.winnerid),
          ]).catch(() => {
            toast({
              title: "Error",
              description: "Failed to finalize game timeout.",
              variant: "destructive",
            });
          });
        }
      }
    }, 1000);

    return () => clearInterval(timerInterval);
  }, [timers, currentPlayer, onTimeUpdate, onTimeout, gameState.gameSessionId, gameMode]);

  // Sync current player with parent
  useEffect(() => {
    if (onPlayerChange) {
      onPlayerChange(currentPlayer);
    }
  }, [currentPlayer, onPlayerChange]);

  const resetSelection = () => {
    setSelectedPiece(null);
    setValidMoves([]);
  };

  const isSelectedPiece = (row: number, col: number): boolean =>
    selectedPiece !== null && selectedPiece.row === row && selectedPiece.col === col;

  const isValidMove = (row: number, col: number): boolean =>
    validMoves.some(move => move.row === row && move.col === col);

  const handleSquareClick = async (row: number, col: number) => {
    if (!gameState.gameSessionId) {
      toast({ title: "Error", description: "Game session not initialized", variant: "destructive" });
      return;
    }
    if (gameState.isCheckmate || isLoadingMove) return;

    // If no piece selected and clicked on own piece, select it
    if (!selectedPiece) {
      const clickedPiece = board[row][col];
      if (clickedPiece && clickedPiece.color === currentPlayer) {
        setSelectedPiece({ row, col });
        const moves = await calculateValidMoves(
          { row, col },
          board,
          currentPlayer,
          gameState.gameSessionId,
          gameMode,
          8,
          true,
          gameState.enPassantTarget
        );
        setValidMoves(moves);
      }
      return;
    }

    // If piece is selected, try to move it
    setIsLoadingMove(true);
    try {
      const move = {
        from: { row: selectedPiece.row, col: selectedPiece.col },
        to: { row, col }
      };

      // Validate move
      const isValid = await chessGameService.validateMove(
        gameState.gameSessionId,
        {
          row: selectedPiece.row,
          col: selectedPiece.col,
          torow: row,
          tocol: col
        }
      );

      if (!isValid) {
        toast({ title: "Invalid Move", variant: "destructive" });
        resetSelection();
        return;
      }

      // Execute move
      await gameService.executeMove(gameState.gameSessionId, move);

      // Update local state
      const newBoard = cloneBoard(board);
      const movingPiece = newBoard[selectedPiece.row][selectedPiece.col];
      if (movingPiece) {
        movingPiece.hasMoved = true;
        newBoard[row][col] = movingPiece;
        newBoard[selectedPiece.row][selectedPiece.col] = null;
      }
      setBoard(newBoard);

      // Switch turns
      const nextPlayer = currentPlayer === "white" ? "black" : "white";
      setCurrentPlayerValue(nextPlayer);

      // Update timers
      if (onTimeUpdate && timers) {
        onTimeUpdate({
          ...timers,
          [currentPlayer]: { ...timers[currentPlayer], active: false },
          [nextPlayer]: { ...timers[nextPlayer], active: true },
        });
      }

      resetSelection();
    } catch (error) {
      toast({ title: "Move Failed", variant: "destructive" });
      resetSelection();
    } finally {
      setIsLoadingMove(false);
    }
  };

  const renderBoard = () => {
    const boardToRender = flipped ? [...board].reverse().map(row => [...row].reverse()) : board;

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
                gameMode={gameMode}
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
          {gameState.checkedPlayer === currentPlayer
            ? "Your king is in check! You must respond."
            : "Opponent's king is in check."}
        </div>
      )}

      {gameState.isCheckmate && (
        <div className="mt-4 p-2 bg-primary/20 text-primary-foreground rounded-md font-bold">
          Checkmate! Game over.
        </div>
      )}

      <GameEndModal
        open={showGameEndModal}
        gameResult={gameResult}
        onClose={() => setShowGameEndModal(false)}
        onPlayAgain={() => {
          setShowGameEndModal(false);
          if (onResetGame) {
            onResetGame();
            setBoard(initialBoard);
            setCurrentPlayerValue("white");
            setGameStateValue({
              ...internalGameState,
              isCheck: false,
              isCheckmate: false,
              checkedPlayer: null,
              currentTurn: "white",
              moveCount: 0,
            });
          }
        }}
      />
    </div>
  );
};

export default ChessBoard;
