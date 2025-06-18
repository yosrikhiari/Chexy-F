import React, { useState, useEffect } from "react";
import { toast } from "@/components/ui/use-toast.tsx";
import {
  PieceColor,
  BoardPosition,
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
import {GameMode} from "@/Interfaces/enums/GameMode.ts";
import { aiserervice } from "@/services/aiService.ts";

// Utility to deep clone the board to prevent direct mutations
const cloneBoard = (board: Piece[][]): Piece[][] =>
  board.map(row => row.map(piece => (piece ? { ...piece } : null)));

// Ensure board is always a valid Piece[][] for classic chess
const ensureClassicBoard = (board: any): Piece[][] => {
  if (!Array.isArray(board) || board.length !== 8 || !board.every((row: any) => Array.isArray(row) && row.length === 8)) {
    console.warn('Invalid board structure, using initialBoard');
    return initialBoard;
  }
  const normalized = board.map((row: any[], rowIndex: number) =>
    row.map((cell: any, colIndex: number) => {
      if (!cell || (typeof cell.type !== 'string' || typeof cell.color !== 'string')) {
        return null;
      }
      const normalizedType = cell.type.toLowerCase() as PieceType;
      const normalizedColor = cell.color.toLowerCase() as PieceColor;
      if (['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'].includes(normalizedType) && ['white', 'black'].includes(normalizedColor)) {
        return { type: normalizedType, color: normalizedColor, hasMoved: cell.hasMoved ?? false };
      }
      return null;
    })
  );
  return normalized;
};

const ChessBoard = ({flipped = false, onPlayerChange, timers, onTimeUpdate, onTimeout, player1Name, player2Name, onResetGame, currentPlayer: propCurrentPlayer, onMove, onGameEnd, gameState: propGameState, onGameStateChange,}: ChessBoardProps) => {
  const [board, setBoard] = useState<Piece[][]>(initialBoard);
  const [selectedPiece, setSelectedPiece] = useState<BoardPosition | null>(null);
  const [validMoves, setValidMoves] = useState<BoardPosition[]>([]);
  const [internalCurrentPlayer, setInternalCurrentPlayer] = useState<PieceColor>("white");
  const [internalGameState, setInternalGameState] = useState<GameState>({
    isDraw: false,
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
    canBlackCastleQueenSide: true
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
// Add to ChessBoard.tsx
  useEffect(() => {
    const checkGameStatus = async () => {
      if (!gameState.gameSessionId || !gameState.gameHistoryId) return;
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
        const newGameState = {
          ...gameState,
          isCheck: whiteInCheck || blackInCheck,
          isCheckmate: isCheckmateState,
          checkedPlayer,
        };
        setGameStateValue(newGameState);
        if (checkedPlayer && isCheckmateState) {
          const winningPlayer = checkedPlayer === "white" ? "black" : "white";
          const winnerName = winningPlayer === "white" ? player1Name : player2Name;
          const pointsAwarded = 100 + (timers ? Math.floor(timers[winningPlayer].timeLeft / 60) * 5 : 0);
          const gameResultData: GameResult = {
            winner: winningPlayer,
            winnerName: winnerName || "Unknown",
            pointsAwarded,
            gameEndReason: "checkmate",
            gameid: gameState.gameSessionId,
            winnerid: winningPlayer === "white" ? gameState.userId1 : gameState.userId2,
          };
          if (onGameEnd) {
            onGameEnd(gameResultData);
          } else {
            setGameResult(gameResultData);
            setShowGameEndModal(true);
          }
          await Promise.all([
            gameHistoryService.completeGameHistory(gameState.gameHistoryId, gameResultData),
            gameSessionService.endGame(gameState.gameSessionId, gameResultData.winnerid),
          ]);
          const updatedSession = await gameSessionService.getGameSession(gameState.gameSessionId);
          if (updatedSession.status !== "COMPLETED") {
            console.error("Failed to update game status to COMPLETED");
            toast({ title: "Error", description: "Game end failed to sync", variant: "destructive" });
          }
        }
      } catch (error) {
        console.error("Error in checkGameStatus:", error);
        toast({
          title: "Error",
          description: "Failed to check game status.",
          variant: "destructive",
        });
      }
    };
    checkGameStatus();
  }, [board, gameState.gameSessionId, gameState.gameHistoryId]);

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
            gameEndReason: "timeout", // Lowercase
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

    setIsLoadingMove(true);
    try {
      // Fetch the latest game state from the server
      const updatedSession = await gameSessionService.getGameSession(gameState.gameSessionId);
      const serverBoard = ensureClassicBoard(updatedSession.board);
      setBoard(serverBoard); // Sync client board with server
      setGameStateValue(updatedSession.gameState);
      setCurrentPlayerValue(updatedSession.gameState.currentTurn);

      // Validate it’s the correct player’s turn
      if (updatedSession.gameState.currentTurn !== currentPlayer) {
        toast({ title: "Error", description: "It’s not your turn", variant: "destructive" });
        resetSelection(); // Deselect if not the player’s turn
        return;
      }

      // If no piece is selected, select it
      if (!selectedPiece) {
        const clickedPiece = serverBoard[row][col];
        if (!clickedPiece || clickedPiece.color !== updatedSession.gameState.currentTurn) {
          toast({ title: "Invalid Selection", description: "Select a piece of your color.", variant: "destructive" });
          return;
        }
        if (clickedPiece && clickedPiece.color === currentPlayer) {
          setSelectedPiece({ row, col });
          const moves = await calculateValidMoves(
            { row, col },
            serverBoard,
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

      // Check if clicking on another piece of the same color
      const clickedPiece = serverBoard[row][col];
      if (clickedPiece && clickedPiece.color === currentPlayer) {
        setSelectedPiece({ row, col });
        const moves = await calculateValidMoves(
          { row, col },
          serverBoard,
          currentPlayer,
          gameState.gameSessionId,
          gameMode,
          8,
          true,
          gameState.enPassantTarget
        );
        setValidMoves(moves);
        return;
      }

      // Check if the target square is a valid move
      const isValid = validMoves.some(m => m.row === row && m.col === col);
      if (!isValid) {
        resetSelection(); // Deselect the piece if the move is invalid
        return;
      }

      // Attempt the move
      const move = {
        from: { row: selectedPiece.row, col: selectedPiece.col },
        to: { row, col }
      };

      // Execute move on the server
      await gameService.executeMove(gameState.gameSessionId, move);
      const postMoveSession = await gameSessionService.getGameSession(gameState.gameSessionId);
      setBoard(ensureClassicBoard(postMoveSession.board));
      setGameStateValue(postMoveSession.gameState);
      setCurrentPlayerValue(postMoveSession.gameState.currentTurn);

      // Update timers
      if (onTimeUpdate && timers) {
        const nextPlayer = currentPlayer === "white" ? "black" : "white";
        onTimeUpdate({
          ...timers,
          [currentPlayer]: { ...timers[currentPlayer], active: false },
          [nextPlayer]: { ...timers[nextPlayer], active: true },
        });
      }

      resetSelection();

      // Trigger bot move if in single-player mode
      if (gameMode === "CLASSIC_SINGLE_PLAYER" && postMoveSession.gameState.currentTurn === "black") {
        await handleBotMove();
      }
    } catch (error) {
      toast({
        title: "Move Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
      resetSelection(); // Deselect on error
    } finally {
      setIsLoadingMove(false);
    }
  };

  useEffect(() => {
    const fetchGameHistory = async () => {
      if (!propGameState?.gameSessionId) return;
      try {
        const history = await gameHistoryService.getGameHistoriesBySession(propGameState.gameSessionId);
        setGameStateValue({ ...gameState, gameHistoryId: history.id });
      } catch (error) {
        console.error("Failed to fetch game history:", error);
        toast({
          title: "Error",
          description: "Failed to load game history.",
          variant: "destructive",
        });
      }
    };
    fetchGameHistory();
  }, [propGameState?.gameSessionId]);


  const handleBotMove = async () => {
    try {
      const session = await gameSessionService.getGameSession(gameState.gameSessionId);
      if (session.status !== "ACTIVE") {
        console.log("[Bot] Game is no longer active, skipping move:", session.status);
        return;
      }

      if (session.gameState.isCheckmate || session.gameState.isDraw) {
        console.log("[Bot] Game is over, ensuring end state");
        if (session.status === "ACTIVE") {
          await gameSessionService.endGame(gameState.gameSessionId, gameState.userId1);
        }
        return;
      }

      if (session.gameState.currentTurn !== "black") {
        console.log("[Bot] Not Black’s turn yet:", session.gameState.currentTurn);
        return;
      }

      setBoard(ensureClassicBoard(session.board));
      setGameStateValue(session.gameState);
      setCurrentPlayerValue(session.gameState.currentTurn);

      const botMove = await aiserervice.getBotMove(gameState.gameSessionId, "black");

      if (!botMove) {
        console.log("[Bot] No valid moves available");
        const isCheck = await chessGameService.isCheck(gameState.gameSessionId, "black");
        if (isCheck) {
          // Checkmate: White wins
          const gameResultData: GameResult = {
            winner: "white",
            winnerName: player1Name || "White",
            pointsAwarded: 100,
            gameEndReason: "checkmate",
            gameid: gameState.gameSessionId,
            winnerid: gameState.userId1,
          };
          setGameResult(gameResultData);
          setShowGameEndModal(true);
          setGameStateValue({ ...gameState, isCheckmate: true, checkedPlayer: "black" });
          try {
            const latestSession = await gameSessionService.getGameSession(gameState.gameSessionId);
            if (latestSession.status === "ACTIVE") {
              await gameSessionService.endGame(gameState.gameSessionId, gameResultData.winnerid);
            } else {
              console.log("[Bot] Game already ended, skipping endGame call");
            }
          } catch (error) {
            if (error.message.includes("Game is not active and cannot be ended")) {
              console.log("[Bot] Game was already ended, ignoring.");
            } else {
              throw error; // Re-throw other unexpected errors
            }
          }
        } else {
          // Stalemate: Draw
          const gameResultData: GameResult = {
            winner: null,
            winnerName: "Draw",
            pointsAwarded: 0,
            gameEndReason: "draw",
            gameid: gameState.gameSessionId,
            winnerid: null,
          };
          setGameResult(gameResultData);
          setShowGameEndModal(true);
          setGameStateValue({ ...gameState, isDraw: true });
          try {
            await gameSessionService.endGame(gameState.gameSessionId, null, true);
          } catch (error) {
            if (error.message.includes("Game is not active and cannot be ended")) {
              console.log("[Bot] Game was already ended, ignoring.");
            } else {
              throw error; // Re-throw other unexpected errors
            }
          }
        }
        return;
      }

      // Validate and execute bot move
      const fromPiece = session.board[botMove.from.row][botMove.from.col];
      if (!fromPiece || fromPiece.color !== "black") {
        throw new Error("Bot selected an invalid piece");
      }

      await gameService.executeMove(gameState.gameSessionId, botMove);
      const updatedSession = await gameSessionService.getGameSession(gameState.gameSessionId);
      setBoard(ensureClassicBoard(updatedSession.board));
      setGameStateValue(updatedSession.gameState);
      setCurrentPlayerValue(updatedSession.gameState.currentTurn);
    } catch (error) {
      console.error("[Bot] Move failed:", error);
      toast({
        title: "Bot Move Failed",
        description: "The bot couldn’t make a move",
        variant: "destructive",
      });
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
        }} onReviewGame={function (): void {
        throw new Error("Function not implemented.");
      }} onBackToMenu={function (): void {
        throw new Error("Function not implemented.");
      }}      />
    </div>
  );
};

export default ChessBoard;
