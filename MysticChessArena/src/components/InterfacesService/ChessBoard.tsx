import React, { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast.tsx";
import { PieceColor, BoardPosition, GameTimers, GameState, GameResult, Piece } from "@/Interfaces/types/chess.ts";
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
import { realtimeService } from "@/services/RealtimeService.ts";

// Utility to deep clone the board to prevent direct mutations
const cloneBoard = (board: Piece[][]): Piece[][] =>
  board.map(row => row.map(piece => (piece ? { ...piece } : null)));

// Ensure board is always a valid Piece[][] for classic chess
const ensureClassicBoard = (board: any): Piece[][] => {
  if (Array.isArray(board) && board.length === 8 && Array.isArray(board[0]) && board[0].length === 8) {
    return board.map((row: any[]) =>
      row.map(cell =>
        cell && "type" in cell && "color" in cell
          ? { ...cell, hasMoved: cell.hasMoved ?? false, enPassantTarget: cell.enPassantTarget ?? false }
          : null
      )
    );
  }
  return initialBoard;
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
      if (!propGameState?.gameSessionId) return;

      try {
        const gameSession: GameSession = await gameSessionService.getGameSession(propGameState.gameSessionId);
        if (gameSession.gameMode !== "CLASSIC_MULTIPLAYER") {
          toast({
            title: "Error",
            description: `This component supports only CLASSIC_MULTIPLAYER mode. Current mode: ${gameSession.gameMode}`,
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
    if (!timers) return;

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
  }, [timers, currentPlayer, onTimeUpdate, onTimeout, gameState.gameSessionId]);

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
    if (gameState.isCheckmate) {
      toast({
        title: "Game Over",
        description: "The game has ended in checkmate.",
        variant: "destructive",
      });
      return;
    }

    if (isLoadingMove) {
      toast({
        title: "Processing",
        description: "Please wait while the move is being processed.",
        variant: "default",
      });
      return;
    }

    if (selectedPiece) {
      const { row: selectedRow, col: selectedCol } = selectedPiece;

      try {
        setIsLoadingMove(true);
        const move = { from: { row: selectedRow, col: selectedCol }, to: { row, col } };
        const isValid = await chessGameService.validateMove(gameState.gameSessionId, move);
        if (!isValid) {
          toast({
            title: "Invalid Move",
            description: "The selected move is not valid.",
            variant: "destructive",
          });
          resetSelection();
          return;
        }

        const newBoard = cloneBoard(board);
        const movingPiece = newBoard[selectedRow][selectedCol];
        if (movingPiece) {
          movingPiece.hasMoved = true;
          newBoard[row][col] = movingPiece;
          newBoard[selectedRow][selectedCol] = null;

          if (board[row][col]) {
            toast({
              title: "Piece Captured!",
              description: `${currentPlayer} captured a ${board[row][col]?.color} ${board[row][col]?.type}`,
            });
          }
        }

        await gameService.executeMove(gameState.gameSessionId, move);
        setBoard(newBoard);

        const nextPlayer = currentPlayer === "white" ? "black" : "white";
        setCurrentPlayerValue(nextPlayer);

        if (onTimeUpdate && timers) {
          const updatedTimers = {
            ...timers,
            [currentPlayer]: { ...timers[currentPlayer], active: false },
            [nextPlayer]: { ...timers[nextPlayer], active: true },
          };
          onTimeUpdate(updatedTimers);
        }

        await realtimeService.broadcastGameState(gameState.gameSessionId);
        resetSelection();
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to execute move. Please try again.",
          variant: "destructive",
        });
        resetSelection();
      } finally {
        setIsLoadingMove(false);
      }
    } else {
      const clickedPiece = board[row][col];
      if (clickedPiece && clickedPiece.color === currentPlayer) {
        setSelectedPiece({ row, col });
        setValidMoves(await calculateValidMoves(
          { row, col },
          board,
          currentPlayer,
          gameState.gameSessionId,
          "CLASSIC_MULTIPLAYER",
          8,
          true,
          gameState.enPassantTarget
        ));
      }
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
                gameMode="CLASSIC_MULTIPLAYER"
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
