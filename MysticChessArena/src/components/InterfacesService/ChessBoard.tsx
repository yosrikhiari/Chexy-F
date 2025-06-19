import React, { useState, useEffect, useRef } from "react";
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
import { GameMode } from "@/Interfaces/enums/GameMode.ts";
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
  const [boardHistory, setBoardHistory] = useState<Piece[][][]>([initialBoard]);
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
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

  const isProcessingRef = useRef(false);

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

  // Fetch initial game state and build board history
  useEffect(() => {
    const fetchGameData = async () => {
      if (!propGameState?.gameSessionId) return;

      try {
        const gameSession: GameSession = await gameSessionService.getGameSession(propGameState.gameSessionId);
        setGameMode(gameSession.gameMode);
        if (gameSession.gameMode !== "CLASSIC_MULTIPLAYER" && gameSession.gameMode !== "CLASSIC_SINGLE_PLAYER") {
          toast({
            title: "Error",
            description: `This component supports only CLASSIC_MULTIPLAYER or CLASSIC_SINGLE_PLAYER mode. Current mode: ${gameSession.gameMode}`,
            variant: "destructive",
          });
          setBoardHistory([initialBoard]);
          return;
        }

        const classicBoard = ensureClassicBoard(gameSession.board);
        const actions = await gameHistoryService.getPlayerActions(gameSession.gameId);
        actions.sort((a, b) => a.sequenceNumber - b.sequenceNumber);

        // Initialize with the starting board from the server
        const history = [classicBoard];
        setBoardHistory(history);
        setCurrentMoveIndex(0);

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
          description: "Failed to fetch game data from server.",
          variant: "destructive",
        });
        setBoardHistory([initialBoard]);
      }
    };
    fetchGameData();
  }, [propGameState?.gameSessionId]);

  // Check game status (check/checkmate)
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
  }, [boardHistory, gameState.gameSessionId, gameState.gameHistoryId]);

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
            winnerid: winningPlayer === "white" ? gameState.userId1 : (gameState.userId2 || "BOT"), // Handle bot case
          };

          setGameResult(gameResultData);
          setShowGameEndModal(true);
          onTimeout(currentPlayer);

          Promise.all([
            gameHistoryService.completeGameHistory(gameState.gameHistoryId, gameResultData), // Fixed: Use gameHistoryId
            gameSessionService.endGame(gameState.gameSessionId, gameResultData.winnerid, false),
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
  }, [timers, currentPlayer, onTimeUpdate, onTimeout, gameState.gameSessionId, gameState.gameHistoryId, gameMode, player1Name, player2Name]);

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
    if (isProcessingRef.current) return; // Block if already processing
    isProcessingRef.current = true;
    try {
      if (currentMoveIndex < boardHistory.length - 1) {
        toast({
          title: "Review Mode",
          description: "Please go to the latest move to continue playing.",
          variant: "default"
        });
        return;
      }
      if (!gameState.gameSessionId) {
        toast({ title: "Error", description: "Game session not initialized", variant: "destructive" });
        return;
      }
      if (gameState.isCheckmate) return;

      const updatedSession = await gameSessionService.getGameSession(gameState.gameSessionId);
      const serverBoard = ensureClassicBoard(updatedSession.board);
      setBoardHistory(prev => {
        const latestBoard = prev[prev.length - 1];
        if (JSON.stringify(latestBoard) !== JSON.stringify(serverBoard)) {
          return [...prev, serverBoard];
        }
        return prev;
      });
      setCurrentMoveIndex(prev => prev + (JSON.stringify(boardHistory[boardHistory.length - 1]) !== JSON.stringify(serverBoard) ? 1 : 0));
      setGameStateValue(updatedSession.gameState);
      setCurrentPlayerValue(updatedSession.gameState.currentTurn);

      if (updatedSession.gameState.currentTurn !== currentPlayer) {
        toast({ title: "Error", description: "It’s not your turn", variant: "destructive" });
        resetSelection();
        return;
      }

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

      const isValid = validMoves.some(m => m.row === row && m.col === col);
      if (!isValid) {
        resetSelection();
        return;
      }

      const move = {
        from: { row: selectedPiece.row, col: selectedPiece.col },
        to: { row, col }
      };

      await gameService.executeMove(gameState.gameSessionId, move);
      const postMoveSession = await gameSessionService.getGameSession(gameState.gameSessionId);
      const newBoard = ensureClassicBoard(postMoveSession.board);
      setBoardHistory(prev => [...prev, newBoard]);
      setCurrentMoveIndex(prev => prev + 1);
      setGameStateValue(postMoveSession.gameState);
      setCurrentPlayerValue(postMoveSession.gameState.currentTurn);

      if (onTimeUpdate && timers) {
        const nextPlayer = currentPlayer === "white" ? "black" : "white";
        onTimeUpdate({
          ...timers,
          [currentPlayer]: { ...timers[currentPlayer], active: false },
          [nextPlayer]: { ...timers[nextPlayer], active: true },
        });
      }

      resetSelection();

      if (gameMode === "CLASSIC_SINGLE_PLAYER" && postMoveSession.gameState.currentTurn === "black") {
        await handleBotMove();
      }
    } catch (error) {
      toast({
        title: "Move Failed",
        description: error instanceof Error ? error.message : "An error occurred",
        variant: "destructive"
      });
      resetSelection();
    } finally {
      isProcessingRef.current = false; // Release lock
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

      setBoardHistory(prev => [...prev, ensureClassicBoard(session.board)]);
      setCurrentMoveIndex(prev => prev + 1);
      setGameStateValue(session.gameState);
      setCurrentPlayerValue(session.gameState.currentTurn);

      const botMove = await aiserervice.getBotMove(gameState.gameSessionId, "black");

      if (!botMove) {
        console.log("[Bot] No valid moves available");
        const isCheck = await chessGameService.isCheck(gameState.gameSessionId, "black");
        if (isCheck) {
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
              throw error;
            }
          }
        } else {
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
              throw error;
            }
          }
        }
        return;
      }

      await gameService.executeMove(gameState.gameSessionId, botMove);
      const updatedSession = await gameSessionService.getGameSession(gameState.gameSessionId);
      setBoardHistory(prev => [...prev, ensureClassicBoard(updatedSession.board)]);
      setCurrentMoveIndex(prev => prev + 1);
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
    const displayBoard = boardHistory[currentMoveIndex];
    const boardToRender = flipped ? [...displayBoard].reverse().map(row => [...row].reverse()) : displayBoard;

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
      <div className="flex justify-center mt-4">
        <button
          onClick={() => setCurrentMoveIndex(prev => Math.max(0, prev - 1))}
          disabled={currentMoveIndex === 0}
          className="mx-2 px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Backward
        </button>
        <button
          onClick={() => setCurrentMoveIndex(prev => Math.min(boardHistory.length - 1, prev + 1))}
          disabled={currentMoveIndex === boardHistory.length - 1}
          className="mx-2 px-4 py-2 bg-blue-500 text-white rounded disabled:opacity-50"
        >
          Forward
        </button>
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
            setBoardHistory([initialBoard]);
            setCurrentMoveIndex(0);
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
        onReviewGame={() => { throw new Error("Function not implemented."); }}
        onBackToMenu={() => { throw new Error("Function not implemented."); }}
      />
    </div>
  );
};

export default ChessBoard;
