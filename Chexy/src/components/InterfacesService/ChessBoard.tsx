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
  import {useLocation} from "react-router-dom";
  import {bots} from "@/Interfaces/Bot.ts";
  import {GameHistory} from "@/Interfaces/types/GameHistory.ts";

  const cloneBoard = (board: Piece[][]): Piece[][] =>
    board.map(row => row.map(piece => (piece ? { ...piece } : null)));

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
                        onGameEnd,
                        gameState: propGameState,
                        onGameStateChange,
                        onMoveMade,
                      }: ChessBoardProps) => {
    const location = useLocation();
    const { botId } = location.state || {};
    const selectedBot = bots.find(bot => bot.id === botId);
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

    const safeCompleteGameHistory = async (result: GameResult) => {
      if (!gameState.gameHistoryId) {
        console.error("Missing gameHistoryId, attempting to create/find history", gameState);

        // Try to get or create game history if missing
        try {
          let history: GameHistory;
          try {
            history = await gameHistoryService.getGameHistoriesBySession(gameState.gameSessionId);
          } catch (error) {
            console.log("Creating new game history for completion...");
            history = await gameHistoryService.createGameHistory(gameState.gameSessionId);
          }

          // Update the game state with the found/created history ID
          setGameStateValue({
            ...gameState,
            gameHistoryId: history.id
          });

          // Now complete with the proper ID
          await gameHistoryService.completeGameHistory(history.id, result);
          return;
        } catch (error) {
          console.error("Failed to create/find game history for completion:", error);
          toast({ title: "Error", description: "Failed to save game result", variant: "destructive" });
          return;
        }
      }

      try {
        await gameHistoryService.completeGameHistory(gameState.gameHistoryId, result);
      } catch (error) {
        console.error("Failed to complete game history:", error);
        toast({ title: "Error", description: "Failed to save game result", variant: "destructive" });
      }
    };


    useEffect(() => {
      const fetchGameData = async () => {
        if (!propGameState?.gameSessionId) return;

        try {
          console.log("Fetching game data for session:", propGameState.gameSessionId);

          // 1. Get game session first
          const gameSession: GameSession = await gameSessionService.getGameSession(propGameState.gameSessionId);
          setGameMode(gameSession.gameMode);

          // 2. Validate game mode
          if (gameSession.gameMode !== "CLASSIC_MULTIPLAYER" && gameSession.gameMode !== "CLASSIC_SINGLE_PLAYER") {
            toast({ title: "Error", description: `Unsupported game mode: ${gameSession.gameMode}`, variant: "destructive" });
            setBoardHistory([initialBoard]);
            return;
          }

          // 3. Get or create game history - THIS IS CRITICAL
          let history: GameHistory;
          try {
            history = await gameHistoryService.getGameHistoriesBySession(propGameState.gameSessionId);
            console.log("Found existing game history:", history.id);
          } catch (error) {
            console.log("Creating new game history for session:", propGameState.gameSessionId);
            history = await gameHistoryService.createGameHistory(propGameState.gameSessionId);
            console.log("Created new game history:", history.id);
          }

          // 4. IMMEDIATELY set the game state with the history ID
          const newGameState = {
            ...gameSession.gameState,
            gameSessionId: propGameState.gameSessionId,
            userId1: propGameState.userId1,
            userId2: propGameState.userId2,
            gameHistoryId: history.id, // This is the critical fix
          };

          console.log("Setting game state with history ID:", newGameState.gameHistoryId);
          setGameStateValue(newGameState);

          // 5. Load board state
          const classicBoard = ensureClassicBoard(gameSession.board);
          const savedHistory = localStorage.getItem(`boardHistory_${propGameState.gameSessionId}`);
          if (savedHistory) {
            setBoardHistory(JSON.parse(savedHistory));
            setCurrentMoveIndex(JSON.parse(savedHistory).length - 1);
          } else {
            setBoardHistory([classicBoard]);
            setCurrentMoveIndex(0);
          }

          setCurrentPlayerValue(gameSession.gameState.currentTurn);
        } catch (error) {
          console.error("Failed to initialize game:", error);
          toast({ title: "Error", description: "Failed to initialize game", variant: "destructive" });
          setBoardHistory([initialBoard]);
        }
      };
      fetchGameData();
    }, [propGameState?.gameSessionId]);

    const ensureGameHistoryId = async (): Promise<string> => {
      if (gameState.gameHistoryId) {
        return gameState.gameHistoryId;
      }

      console.warn("gameHistoryId missing, attempting to recover...");
      try {
        let history: GameHistory;
        try {
          history = await gameHistoryService.getGameHistoriesBySession(gameState.gameSessionId);
        } catch (error) {
          history = await gameHistoryService.createGameHistory(gameState.gameSessionId);
        }

        setGameStateValue({
          ...gameState,
          gameHistoryId: history.id
        });

        return history.id;
      } catch (error) {
        throw new Error("Failed to ensure game history ID");
      }
    };

    const completeGameWithEnsuredHistory = async (result: GameResult) => {
      try {
        const historyId = await ensureGameHistoryId();
        await gameHistoryService.completeGameHistory(historyId, result);
      } catch (error) {
        console.error("Failed to complete game history:", error);
        toast({ title: "Error", description: "Failed to save game result", variant: "destructive" });
      }
    };

    useEffect(() => {
      console.log("Game state updated - gameHistoryId:", gameState.gameHistoryId, "gameSessionId:", gameState.gameSessionId);
      if (gameState.gameSessionId && !gameState.gameHistoryId) {
        console.warn("WARNING: gameSessionId exists but gameHistoryId is missing!");
      }
    }, [gameState.gameHistoryId, gameState.gameSessionId]);


    useEffect(() => {
      const syncMoves = async () => {
        if (!gameState.gameSessionId) return;
        const session = await gameSessionService.getGameSession(gameState.gameSessionId);
        const serverBoard = ensureClassicBoard(session.board);
        const savedHistory = localStorage.getItem(`boardHistory_${gameState.gameSessionId}`);
        const currentHistory = savedHistory ? JSON.parse(savedHistory) : [serverBoard];

        // Reconstruct moves if needed (optional, depending on backend support)
        setBoardHistory(currentHistory);
        setCurrentMoveIndex(currentHistory.length - 1);
      };
      syncMoves();
    }, [gameState.gameSessionId, gameState.currentTurn]);
  
    useEffect(() => {
      const checkGameStatus = async () => {
        if (!gameState.gameSessionId || !gameState.gameHistoryId || gameState.isCheckmate || gameState.isDraw) return;
        try {
          const updatedSession = await gameSessionService.getGameSession(gameState.gameSessionId);
          const whiteInCheck = await chessGameService.isCheck(gameState.gameSessionId, "white");
          const blackInCheck = await chessGameService.isCheck(gameState.gameSessionId, "black");
          let checkedPlayer: PieceColor | null = null;
          if (whiteInCheck) checkedPlayer = "white";
          else if (blackInCheck) checkedPlayer = "black";
          let isCheckmateState = false;
          if (checkedPlayer) {
            isCheckmateState = await chessGameService.isCheckmate(gameState.gameSessionId, checkedPlayer);
          }
          const isDrawState = !isCheckmateState && await chessGameService.isDraw(gameState.gameSessionId, updatedSession.gameState.currentTurn);
          const newGameState = {
            ...gameState,
            isCheck: whiteInCheck || blackInCheck,
            isCheckmate: isCheckmateState,
            isDraw: isDrawState,
            checkedPlayer,
          };
          setGameStateValue(newGameState);
          if (isCheckmateState && checkedPlayer) {
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
              await completeGameWithEnsuredHistory(gameResultData),
              gameSessionService.endGame(gameState.gameSessionId, gameResultData.winnerid),
            ]);
          } else if (isDrawState) {
            const gameResultData: GameResult = {
              winner: null,
              winnerName: "Draw",
              pointsAwarded: 0,
              gameEndReason: "draw",
              gameid: gameState.gameSessionId,
              winnerid: null,
            };
            if (onGameEnd) {
              onGameEnd(gameResultData);
            } else {
              setGameResult(gameResultData);
              setShowGameEndModal(true);
            }
            await Promise.all([
              await completeGameWithEnsuredHistory(gameResultData),
              gameSessionService.endGame(gameState.gameSessionId, null, true),
            ]);
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

    }, [gameState.gameSessionId, gameState.gameHistoryId]);

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
              winnerid: winningPlayer === "white" ? gameState.userId1 : (gameState.userId2 || "BOT"),
            };

            setGameResult(gameResultData);
            setShowGameEndModal(true);
            onTimeout(currentPlayer);

            Promise.all([
              completeGameWithEnsuredHistory(gameResultData),
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
    }, [timers, currentPlayer, onTimeUpdate, onTimeout, gameState.gameSessionId, gameState.gameHistoryId, gameMode, player1Name, player2Name]);

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
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;
      try {
        if (currentMoveIndex < boardHistory.length - 1) {
          toast({
            title: "Review Mode",
            description: "Please go to the latest move to continue playing.",
            variant: "default",
          });
          return;
        }
        if (!gameState.gameSessionId) {
          toast({ title: "Error", description: "Game session not initialized", variant: "destructive" });
          return;
        }
        if (gameState.isCheckmate) return;

        const updatedSession = await gameSessionService.getGameSession(gameState.gameSessionId);
        setGameStateValue(updatedSession.gameState);
        setCurrentPlayerValue(updatedSession.gameState.currentTurn);

        if (updatedSession.gameState.currentTurn !== currentPlayer) {
          toast({ title: "Error", description: "It’s not your turn", variant: "destructive" });
          resetSelection();
          return;
        }

        const serverBoard = ensureClassicBoard(updatedSession.board);

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
          to: { row, col },
        };
        const isCapture = !!serverBoard[row][col];
        const pieceType = serverBoard[selectedPiece.row][selectedPiece.col].type;

        console.log(`[DEBUG] Executing move: from=[${move.from.row},${move.from.col}], to=[${move.to.row},${move.to.col}]`);
        await gameService.executeMove(gameState.gameSessionId, move);
        const postMoveSession = await gameSessionService.getGameSession(gameState.gameSessionId);
        const newBoard = ensureClassicBoard(postMoveSession.board);
        setBoardHistory(prev => {
          const newHistory = [...prev, newBoard];
          localStorage.setItem(`boardHistory_${gameState.gameSessionId}`, JSON.stringify(newHistory));
          console.log(`[DEBUG] Adding post-move board to history: new length=${newHistory.length}, board=`, newBoard);
          return newHistory;
        });
        setCurrentMoveIndex(prev => {
          const newIndex = prev + 1;
          console.log(`[DEBUG] Post-move currentMoveIndex: prev=${prev}, newIndex=${newIndex}`);
          return newIndex;
        });

        const opponentColor = currentPlayer === "white" ? "black" : "white";
        const isCheck = await chessGameService.isCheck(gameState.gameSessionId, opponentColor);
        const isCheckmate = isCheck && await chessGameService.isCheckmate(gameState.gameSessionId, opponentColor);
        const isStalemate = !isCheck && await chessGameService.isDraw(gameState.gameSessionId, postMoveSession.gameState.currentTurn);

        if (isCheckmate) {
          const winningPlayer = opponentColor === "white" ? "black" : "white";
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
            completeGameWithEnsuredHistory(gameResultData),
            gameSessionService.endGame(gameState.gameSessionId, gameResultData.winnerid),
          ]);
        } else if (isStalemate) {
          const gameResultData: GameResult = {
            winner: null,
            winnerName: "Draw",
            pointsAwarded: 0,
            gameEndReason: "draw",
            gameid: gameState.gameSessionId,
            winnerid: null,
          };
          if (onGameEnd) {
            onGameEnd(gameResultData);
          } else {
            setGameResult(gameResultData);
            setShowGameEndModal(true);
          }
          await Promise.all([
            completeGameWithEnsuredHistory(gameResultData),
            gameSessionService.endGame(gameState.gameSessionId, null, true),
          ]);
        }

        if (onMoveMade) {
          onMoveMade({
            from: move.from,
            to: move.to,
            actionType: isCapture ? "capture" : "move",
            pieceType,
            resultsInCheck: isCheck && !isCheckmate,
            resultsInCheckmate: isCheckmate,
            resultsInStalemate: isStalemate,
          });
        }

        setGameStateValue({
          ...postMoveSession.gameState,
          isCheck,
          isCheckmate,
          checkedPlayer: isCheck ? opponentColor : null,
        });
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
          variant: "destructive",
        });
        resetSelection();
      } finally {
        isProcessingRef.current = false;
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
        setIsLoadingMove(true);

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
          console.log("[Bot] Not Black's turn yet:", session.gameState.currentTurn);
          return;
        }

        setGameStateValue(session.gameState);
        setCurrentPlayerValue(session.gameState.currentTurn);

        const botPoints = selectedBot?.points || 600;

        toast({
          title: `${selectedBot?.name || 'Bot'} is thinking...`,
          description: `Difficulty: ${botPoints} points`,
          duration: 3000
        });

        const botMove = await aiserervice.getBotMove(
          gameState.gameSessionId,
          "black",
          botPoints
        );

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
            if (onGameEnd) {
              onGameEnd(gameResultData);
            } else {
              setGameResult(gameResultData);
              setShowGameEndModal(true);
            }
            setGameStateValue({ ...gameState, isCheckmate: true, checkedPlayer: "black" });
            await gameSessionService.endGame(gameState.gameSessionId, gameResultData.winnerid);
          } else {
            const gameResultData: GameResult = {
              winner: null,
              winnerName: "Draw",
              pointsAwarded: 0,
              gameEndReason: "draw",
              gameid: gameState.gameSessionId,
              winnerid: null,
            };
            if (onGameEnd) {
              onGameEnd(gameResultData);
            } else {
              setGameResult(gameResultData);
              setShowGameEndModal(true);
            }
            setGameStateValue({ ...gameState, isDraw: true });
            await gameSessionService.endGame(gameState.gameSessionId, null, true);
          }
          return;
        }

        const serverBoard = ensureClassicBoard(session.board);
        const isCapture = !!serverBoard[botMove.to.row][botMove.to.col];
        const pieceType = serverBoard[botMove.from.row][botMove.from.col].type;

        console.log(`[Bot] Executing move: from [${botMove.from.row},${botMove.from.col}] to [${botMove.to.row},${botMove.to.col}]`);

        await gameService.executeMove(gameState.gameSessionId, botMove);
        const updatedSession = await gameSessionService.getGameSession(gameState.gameSessionId);

        setBoardHistory(prev => {
          const newHistory = [...prev, ensureClassicBoard(updatedSession.board)];
          localStorage.setItem(`boardHistory_${gameState.gameSessionId}`, JSON.stringify(newHistory));
          return newHistory;
        });
        setCurrentMoveIndex(prev => prev + 1);

        const isCheck = await chessGameService.isCheck(gameState.gameSessionId, "white"); // Check for white after bot's move
        const isCheckmate = isCheck && await chessGameService.isCheckmate(gameState.gameSessionId, "white");
        const isStalemate = !isCheck && await chessGameService.isDraw(gameState.gameSessionId, "white");

        console.log("Bot move:", botMove);
        if (onMoveMade) {
          onMoveMade({
            from: botMove.from,
            to: botMove.to,
            actionType: isCapture ? 'capture' : 'move',
            pieceType,
            resultsInCheck: isCheck && !isCheckmate,
            resultsInCheckmate: isCheckmate,
            resultsInStalemate: isStalemate,
          });
        }

        setGameStateValue({
          ...updatedSession.gameState,
          isCheck,
          isCheckmate,
          checkedPlayer: isCheck ? "white" : null,
          isDraw: isStalemate,
        });
        setCurrentPlayerValue(updatedSession.gameState.currentTurn);

        // Handle game end conditions
        if (isCheckmate) {
          const gameResultData: GameResult = {
            winner: "black",
            winnerName: player2Name || "Bot",
            pointsAwarded: 100,
            gameEndReason: "checkmate",
            gameid: gameState.gameSessionId,
            winnerid: gameState.userId2 || "BOT",
          };
          if (onGameEnd) {
            onGameEnd(gameResultData);
          } else {
            setGameResult(gameResultData);
            setShowGameEndModal(true);
          }
          await gameSessionService.endGame(gameState.gameSessionId, gameResultData.winnerid);
        } else if (isStalemate) {
          const gameResultData: GameResult = {
            winner: null,
            winnerName: "Draw",
            pointsAwarded: 0,
            gameEndReason: "draw",
            gameid: gameState.gameSessionId,
            winnerid: null,
          };
          if (onGameEnd) {
            onGameEnd(gameResultData);
          } else {
            setGameResult(gameResultData);
            setShowGameEndModal(true);
          }
          await gameSessionService.endGame(gameState.gameSessionId, null, true);
        }

      } catch (error) {
        console.error("[Bot] Move failed:", error);
        toast({
          title: "Bot Move Failed",
          description: error instanceof Error ? error.message : "The bot couldn't make a move",
          variant: "destructive",
        });
      } finally {
        setIsLoadingMove(false);
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
