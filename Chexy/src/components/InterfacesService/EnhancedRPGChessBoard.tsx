import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { EnhancedGameState, EnhancedRPGPiece, TeleportPortal, CombatResult } from "@/Interfaces/types/enhancedRpgChess.ts";
import { BoardPosition, PieceColor, Piece } from "@/Interfaces/types/chess.ts";
import { RPGPiece } from "@/Interfaces/types/rpgChess.ts";
import { calculateValidMoves, calculateRPGValidMoves } from "@/utils/chessUtils.ts";
import { generateTeleportPortals, calculateTeleportPortals } from "@/utils/dynamicBoardEffects.ts";
import ChessSquare from "./ChessSquare.tsx";
import { ArrowLeft, RotateCcw, Move, ZoomIn, ZoomOut, RotateCw } from "lucide-react";
import { EnhancedRPGChessBoardProps } from "@/Interfaces/EnhancedRPGChessBoardProps.ts";
import { toast } from "@/components/ui/use-toast.tsx";
import { PlayerAction } from "@/Interfaces/services/PlayerAction.ts";
import { GameSession } from "@/Interfaces/types/GameSession.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { rpgGameService } from "@/services/RPGGameService.ts";
import { gameService } from "@/services/GameService.ts";
import { JwtService } from "@/services/JwtService.ts";
import { gameHistoryService } from "@/services/GameHistoryService.ts";
import { chessGameService } from "@/services/ChessGameService.ts";
// Realtime broadcasting disabled for RPG games
import { enhancedRPGService } from "@/services/EnhancedRPGService.ts";
import {AIService} from "@/services/aiService.ts";

const EnhancedRPGChessBoard: React.FC<EnhancedRPGChessBoardProps> = ({
                                                                       gameState,
                                                                       onBattleComplete,
                                                                       onBackToPreparation,
                                                                     }) => {
  const boardRef = useRef<HTMLDivElement>(null);
  const [board, setBoard] = useState<(EnhancedRPGPiece | null)[][]>(() =>
    Array(gameState.boardSize)
      .fill(null)
      .map(() => Array(gameState.boardSize).fill(null))
  );
  const [currentPlayer, setCurrentPlayer] = useState<PieceColor>("white");
  const [selectedSquare, setSelectedSquare] = useState<BoardPosition | null>(null);
  const [validMoves, setValidMoves] = useState<BoardPosition[]>([]);
  const [gameOver, setGameOver] = useState(gameState.isGameOver);
  const [winner, setWinner] = useState<PieceColor | null>(null);
  const [teleportPortals, setTeleportPortals] = useState<TeleportPortal[]>([]);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [difficulty, setDifficulty] = useState<number>(() => {
    const wins = Number(localStorage.getItem('rpgWins') || '0');
    return Math.min(10, 1 + wins);
  });
  const [teleportAnim, setTeleportAnim] = useState<{
    active: boolean;
    from: BoardPosition | null;
    to: BoardPosition | null;
  }>({ active: false, from: null, to: null });

  // Drag and viewport state for large boards
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [boardOffset, setBoardOffset] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);
  const isProcessingMoveRef = useRef(false);

  const maxBoardDisplaySize = 640;
  const squareSize = Math.min(80, maxBoardDisplaySize / gameState.boardSize);
  const needsDragging = gameState.boardSize > 10;

  useEffect(() => {
    initializeEnhancedBoard();
  }, [gameState.playerArmy, gameState.boardSize, gameState.gameid]);

  /** Type guard to check if a board is an EnhancedRPGPiece array */
  const isEnhancedRPGPieceArray = (board: any): board is EnhancedRPGPiece[][] => {
    return (
      Array.isArray(board) &&
      board.every((row) =>
        Array.isArray(row) &&
        row.every(
          (piece) =>
            piece === null ||
            (typeof piece === "object" &&
              "pluscurrentHp" in piece &&
              "plusmaxHp" in piece &&
              "plusattack" in piece &&
              "plusdefense" in piece &&
              "pluslevel" in piece &&
              "plusexperience" in piece)
        )
      )
    );
  };

  /** Convert a piece to EnhancedRPGPiece with proper defaults and type safety */
  const convertToEnhancedRPGPiece = (piece: Piece | RPGPiece | EnhancedRPGPiece): EnhancedRPGPiece => {
    const basePiece: Partial<EnhancedRPGPiece> = {
      id: piece.id || `${piece.type}-${Math.random().toString(36).slice(2)}`,
      type: piece.type,
      color: piece.color,
      name: "name" in piece ? (piece as RPGPiece).name || piece.type : piece.type,
      description: "description" in piece ? (piece as RPGPiece).description || `${piece.type} piece` : `${piece.type} piece`,
      specialAbility: "specialAbility" in piece ? (piece as RPGPiece).specialAbility || "none" : "none",
      hp: "hp" in piece ? (piece as RPGPiece).hp || 10 : 10,
      maxHp: "maxHp" in piece ? (piece as RPGPiece).maxHp || 10 : 10,
      attack: "attack" in piece ? (piece as RPGPiece).attack || 5 : 5,
      defense: "defense" in piece ? (piece as RPGPiece).defense || 5 : 5,
      rarity: "rarity" in piece ? (piece as RPGPiece).rarity || "common" : "common",
      isJoker: "isJoker" in piece ? (piece as RPGPiece).isJoker || false : false,
      pluscurrentHp: "pluscurrentHp" in piece ? (piece as EnhancedRPGPiece).pluscurrentHp || ("hp" in piece ? (piece as RPGPiece).hp : 10) : 10,
      plusmaxHp: "plusmaxHp" in piece ? (piece as EnhancedRPGPiece).plusmaxHp || ("maxHp" in piece ? (piece as RPGPiece).maxHp : 10) : 10,
      plusattack: "plusattack" in piece ? (piece as EnhancedRPGPiece).plusattack || ("attack" in piece ? (piece as RPGPiece).attack : 5) : 5,
      plusdefense: "plusdefense" in piece ? (piece as EnhancedRPGPiece).plusdefense || ("defense" in piece ? (piece as RPGPiece).defense : 5) : 5,
      pluslevel: "pluslevel" in piece ? (piece as EnhancedRPGPiece).pluslevel || 1 : 1,
      plusexperience: "plusexperience" in piece ? (piece as EnhancedRPGPiece).plusexperience || 0 : 0,
      position: "position" in piece ? (piece as RPGPiece).position : undefined,
      hasMoved: "hasMoved" in piece ? (piece as RPGPiece).hasMoved || false : false,
    };
    return basePiece as EnhancedRPGPiece;
  };

  /** Initialize the board with player and enemy pieces */
  const initializeEnhancedBoard = async () => {
    try {
      setIsLoading(true);
      const sessionId = (gameState as any).gameSessionId || gameState.gameid;
      const session = await gameSessionService.getGameSession(sessionId);
      setGameSession(session);

      let newBoard: (EnhancedRPGPiece | null)[][];

      // Fetch RPG game state for consistency
      const rpgState = await rpgGameService.getRPGGame(gameState.gameid);

      if (session.board && isEnhancedRPGPieceArray(session.board)) {
        newBoard = session.board.map((row) => row.map((piece) => (piece ? convertToEnhancedRPGPiece(piece) : null)));
      } else {
        // Initialize empty board
        const size = gameState.boardSize;
        newBoard = Array(size)
          .fill(null)
          .map(() => Array(size).fill(null));

        // Place player pieces in the bottom rows
        let playerPieceIndex = 0;
        for (let row = size - 2; row < size && playerPieceIndex < gameState.playerArmy.length; row++) {
          for (let col = 0; col < size && playerPieceIndex < gameState.playerArmy.length; col++) {
            const rpgPiece = gameState.playerArmy[playerPieceIndex];
            newBoard[row][col] = convertToEnhancedRPGPiece({
              ...rpgPiece,
              color: "white",
              position: { row, col },
            });
            playerPieceIndex++;
          }
        }

        // Place enemy pieces
        const enemyArmy = gameState.enemyArmy.length
          ? gameState.enemyArmy
          : generateDefaultEnemyArmy(size);
        let enemyIndex = 0;
        for (let row = 0; row < 2 && enemyIndex < enemyArmy.length; row++) {
          for (let col = 0; col < size && enemyIndex < enemyArmy.length; col++) {
            newBoard[row][col] = convertToEnhancedRPGPiece({
              ...enemyArmy[enemyIndex],
              color: "black",
              position: { row, col },
            });
            enemyIndex++;
          }
        }
      }

      // Do not auto-create portals here. They are added only via modifiers/drafts.
      setTeleportPortals([]);

      setBoard(newBoard);
      setIsLoading(false);
    } catch (error) {
      console.error("Board initialization error:", error);
      setIsLoading(false);
      toast({ title: "Error", description: "Failed to initialize board.", variant: "destructive" });
    }
  };

  /** Check if the game is over based on the current objective */
  const checkGameOver = async (currentBoard: (EnhancedRPGPiece | null)[][]): Promise<boolean> => {
    const playerPieces = currentBoard.flat().filter((piece) => piece && piece.color === "white");
    const enemyPieces = currentBoard.flat().filter((piece) => piece && piece.color === "black");

    const objective = gameState.currentObjective;

    if (!gameSession) {
      toast({ title: "Error", description: "Game session not initialized.", variant: "destructive" });
      return false;
    }

    if (objective === "checkmate") {
      const playerKing = playerPieces.find((piece) => piece.type === "king");
      const enemyKing = enemyPieces.find((piece) => piece.type === "king");

      if (!enemyKing) {
        setGameOver(true);
        setWinner("white");
        await gameSessionService.endGame(gameState.gameid, gameSession.whitePlayer.userId);
        await gameHistoryService.completeGameHistory(gameSession.gameHistoryId, {
          winner: "white",
          winnerName: gameSession.whitePlayer.username || "Player",
          pointsAwarded: 100,
          gameEndReason: "checkmate",
          gameid: gameState.gameid,
          winnerid: gameSession.whitePlayer.userId || "",
        });
        await rpgGameService.endRPGGame(gameState.gameid, true);
        onBattleComplete(true);
        return true;
      } else if (!playerKing) {
        setGameOver(true);
        setWinner("black");
        await gameSessionService.endGame(gameState.gameid);
        await gameHistoryService.completeGameHistory(gameSession.gameHistoryId, {
          winner: "black",
          winnerName: "Enemy AI",
          pointsAwarded: 0,
          gameEndReason: "checkmate",
          gameid: gameState.gameid,
          winnerid: "",
        });
        await rpgGameService.endRPGGame(gameState.gameid, false);
        onBattleComplete(false);
        return true;
      }
    } else if (objective === "survive" && gameState.turnsRemaining !== undefined) {
      if (gameState.turnsRemaining <= 0 && playerPieces.length > 0) {
        setGameOver(true);
        setWinner("white");
        await gameSessionService.endGame(gameState.gameid, gameSession.whitePlayer.userId);
        await gameHistoryService.completeGameHistory(gameSession.gameHistoryId, {
          winner: "white",
          winnerName: gameSession.whitePlayer.username || "Player",
          pointsAwarded: 100,
          gameEndReason: "timeout",
          gameid: gameState.gameid,
          winnerid: gameSession.whitePlayer.userId || "",
        });
        await rpgGameService.endRPGGame(gameState.gameid, true);
        onBattleComplete(true);
        return true;
      } else if (playerPieces.length === 0) {
        setGameOver(true);
        setWinner("black");
        await gameSessionService.endGame(gameState.gameid);
        await gameHistoryService.completeGameHistory(gameSession.gameHistoryId, {
          winner: "black",
          winnerName: "Enemy AI",
          pointsAwarded: 0,
          gameEndReason: "checkmate",
          gameid: gameState.gameid,
          winnerid: "",
        });
        await rpgGameService.endRPGGame(gameState.gameid, false);
        onBattleComplete(false);
        return true;
      }
    } else if (objective === "capture_key") {
      const keyHolder = currentBoard.flat().find((piece) => piece && piece.specialAbility === "key_holder");
      if (keyHolder && keyHolder.color === "white") {
        setGameOver(true);
        setWinner("white");
        await gameSessionService.endGame(gameState.gameid, gameSession.whitePlayer.userId);
        await gameHistoryService.completeGameHistory(gameSession.gameHistoryId, {
          winner: "white",
          winnerName: gameSession.whitePlayer.username || "Player",
          pointsAwarded: 150,
          gameEndReason: "capture_key",
          gameid: gameState.gameid,
          winnerid: gameSession.whitePlayer.userId || "",
        });
        await rpgGameService.endRPGGame(gameState.gameid, true);
        onBattleComplete(true);
        return true;
      } else if (keyHolder && keyHolder.color === "black") {
        setGameOver(true);
        setWinner("black");
        await gameSessionService.endGame(gameState.gameid);
        await gameHistoryService.completeGameHistory(gameSession.gameHistoryId, {
          winner: "black",
          winnerName: "Enemy AI",
          pointsAwarded: 0,
          gameEndReason: "capture_key",
          gameid: gameState.gameid,
          winnerid: "",
        });
        await rpgGameService.endRPGGame(gameState.gameid, false);
        onBattleComplete(false);
        return true;
      }
    }

    return false;
  };

  const getValidatedPlayerId = (gameSession: any): string => {
    // Try multiple sources in order of priority
    const playerId =
      JwtService.getKeycloakId() ||
      gameSession?.whitePlayer?.userId ||
      gameSession?.currentPlayerId ||
      localStorage.getItem('userId');

    if (!playerId) {
      throw new Error('No valid player ID found. Please log in again.');
    }

    return playerId;
  };

  /** Constrain the board offset for dragging */
  const constrainOffset = (offset: { x: number; y: number }) => {
    const boardWidth = gameState.boardSize * squareSize * zoomLevel;
    const boardHeight = boardWidth;
    const containerWidth = maxBoardDisplaySize;
    const containerHeight = maxBoardDisplaySize;

    return {
      x: Math.min(0, Math.max(offset.x, containerWidth - boardWidth)),
      y: Math.min(0, Math.max(offset.y, containerHeight - boardHeight)),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (needsDragging) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - boardOffset.x, y: e.clientY - boardOffset.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && needsDragging) {
      const newOffset = constrainOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
      setBoardOffset(newOffset);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  /** Handle square clicks for piece selection and movement */
  const handleSquareClick = async (row: number, col: number) => {
    if (gameOver || isDragging || isLoading || isProcessingMoveRef.current) return;

    const clickedPiece = board[row][col];

    if (!selectedSquare) {
      if (clickedPiece && clickedPiece.color === currentPlayer) {
        setSelectedSquare({ row, col });
        // Use RPG movement validation for RPG modes
        const moves = calculateRPGValidMoves({ row, col }, board, currentPlayer, gameState.boardSize);
        setValidMoves(moves);
      }
      return;
    }

    if (selectedSquare.row === row && selectedSquare.col === col) {
      setSelectedSquare(null);
      setValidMoves([]);
      return;
    }

    const isValidMove = validMoves.some((m) => m.row === row && m.col === col);
    if (isValidMove) {
      await makeEnhancedMove(selectedSquare, { row, col });
      setSelectedSquare(null);
      setValidMoves([]);
    } else if (clickedPiece && clickedPiece.color === currentPlayer) {
      setSelectedSquare({ row, col });
      const moves = calculateRPGValidMoves({ row, col }, board, currentPlayer, gameState.boardSize);
      setValidMoves(moves);
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  /** Execute a move, including combat and teleportation */
  const makeEnhancedMove = async (
    from: BoardPosition,
    to: BoardPosition,
    isAI: boolean = false,
    boardOverride?: (EnhancedRPGPiece | null)[][]
  ) => {
    try {
      if (isProcessingMoveRef.current) return;
      isProcessingMoveRef.current = true;
      const sourceBoard = boardOverride || board;
      const movingPiece = sourceBoard[from.row][from.col];
      if (!movingPiece) return;
      // Allow AI (black) to move regardless of currentPlayer state to avoid race conditions
      if (!isAI && movingPiece.color !== currentPlayer) return;
      if (isAI && movingPiece.color !== 'black') return;

      const newBoard = sourceBoard.map((row) => [...row]);
      const targetPiece = newBoard[to.row][to.col];
      let finalDestination = to;

      const playerId = getValidatedPlayerId(gameSession);

      // Handle RPG combat (teleport attack animation + damage application)
// Replace the combat handling section in makeEnhancedMove (around line 380-430)
// Find this section and replace it:

// Handle RPG combat (teleport attack animation + damage application)
      if (targetPiece && targetPiece.color !== movingPiece.color) {
        // Determine if attacker is a player piece
        const isAttackerPlayerPiece = movingPiece.color === 'white';

        // Compute damage: attack - defense, minimum 1
        const attackerBaseAttack = (movingPiece.plusattack ?? movingPiece.attack ?? 5);
        const attackerName = (movingPiece.name || movingPiece.type || '').toLowerCase();
        const attackerAbility = (movingPiece.specialAbility || '').toLowerCase();
        const defenderAbility = (targetPiece.specialAbility || '').toLowerCase();

        // Ability modifiers
        const seerDamageMultiplier = attackerName.includes('seer') ? 0.6 : 1.0;
        const lungeBonus = attackerAbility.includes('lunge') ? 1 : 0;
        const guardReduction = defenderAbility.includes('guard') ? 1 : 0;

        const attackerAttack = Math.max(1, Math.floor(attackerBaseAttack * seerDamageMultiplier) + lungeBonus);
        const defenderDefense = (targetPiece.plusdefense ?? targetPiece.defense ?? 5) + guardReduction;
        const rawDamage = attackerAttack - defenderDefense;
        const damage = Math.max(1, rawDamage);

        // Teleport animation: temporarily move attacker to defender square
        const animBoard = newBoard.map((row) => [...row]);
        animBoard[to.row][to.col] = { ...movingPiece, position: to } as EnhancedRPGPiece;
        animBoard[from.row][from.col] = null;
        setTeleportAnim({ active: true, from, to });
        setBoard(animBoard);

        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Apply damage to defender and return attacker to original square
        const postBoard = animBoard.map((row) => [...row]);
        const newHp = Math.max(0, (targetPiece.pluscurrentHp ?? targetPiece.hp ?? 10) - damage);

        if (newHp <= 0) {
          // Defender defeated
          postBoard[to.row][to.col] = null;
          toast({
            title: "Combat Victory",
            description: `${targetPiece.name} was defeated!`
          });

          // CRITICAL: Track kill ONLY if attacker is a player piece defeating an enemy
          if (isAttackerPlayerPiece) {
            try {
              console.log(`Tracking kill for player piece: ${movingPiece.name} (ID: ${movingPiece.id})`);
              await rpgGameService.trackKill(gameState.gameid, movingPiece.id, playerId);

              // Refresh game state to get updated levels and stats
              const updatedGameState = await rpgGameService.getRPGGame(gameState.gameid);

              // Find the updated attacker piece and sync its stats
              const updatedAttacker = updatedGameState.playerArmy.find(p => p.id === movingPiece.id);
              if (updatedAttacker) {
                // Update the attacker in the board with new stats from backend
                const enhancedAttacker = {
                  ...movingPiece,
                  pluslevel: updatedAttacker.pluslevel || movingPiece.pluslevel,
                  plusmaxHp: updatedAttacker.plusmaxHp || movingPiece.plusmaxHp,
                  pluscurrentHp: updatedAttacker.pluscurrentHp || movingPiece.pluscurrentHp,
                  plusattack: updatedAttacker.plusattack || movingPiece.plusattack,
                  plusdefense: updatedAttacker.plusdefense || movingPiece.plusdefense,
                  plusexperience: updatedAttacker.plusexperience || 0,
                };

                postBoard[from.row][from.col] = { ...enhancedAttacker, position: from } as EnhancedRPGPiece;

                // Show level up notification if leveled
                if (updatedAttacker.pluslevel > movingPiece.pluslevel) {
                  toast({
                    title: "âœ¨ Level Up!",
                    description: `${movingPiece.name} reached Level ${updatedAttacker.pluslevel}!`,
                    duration: 3000,
                  });
                }
              } else {
                // Fallback if updated piece not found
                postBoard[from.row][from.col] = { ...movingPiece, position: from } as EnhancedRPGPiece;
              }

            } catch (error) {
              console.error("Failed to track kill:", error);
              // Continue anyway - don't block combat
              postBoard[from.row][from.col] = { ...movingPiece, position: from } as EnhancedRPGPiece;
              toast({
                title: "Warning",
                description: "Failed to track kill progress.",
                variant: "destructive",
              });
            }
          } else {
            // Enemy piece killed player piece - no tracking
            console.log(`Enemy piece ${movingPiece.name} defeated player piece - no tracking`);
            postBoard[from.row][from.col] = { ...movingPiece, position: from } as EnhancedRPGPiece;
          }
        } else {
          // Defender survived
          postBoard[to.row][to.col] = {
            ...targetPiece,
            pluscurrentHp: newHp,
          } as EnhancedRPGPiece;
          toast({
            title: "Combat",
            description: `${targetPiece.name} took ${damage} damage (HP ${newHp}).`
          });

          // Return attacker to original square
          postBoard[from.row][from.col] = { ...movingPiece, position: from } as EnhancedRPGPiece;
        }

        setTeleportAnim({ active: false, from: null, to: null });
        setBoard(postBoard);

        // Check game over and handle turns
        const ended = await checkGameOver(postBoard);
        if (!ended) {
          if (isAI) {
            setCurrentPlayer("white");
          } else {
            setCurrentPlayer("black");
            setTimeout(() => makeAIMove(postBoard), 600);
          }
        }
        return;
      }
      // Handle teleport portal
      const portal = teleportPortals.find((p) => p.position.row === to.row && p.position.col === to.col && p.isActive);
      if (portal && portal.to) {
        finalDestination = portal.to;
        setTeleportPortals((prev) =>
          prev.map((p) => (p.id === portal.id || p.id === portal.linkedPortal ? { ...p, isActive: false } : p))
        );
      }

      // Execute the move locally
      newBoard[finalDestination.row][finalDestination.col] = { ...movingPiece, position: finalDestination };
      newBoard[from.row][from.col] = null;
      setBoard(newBoard);

      // Record player action
      if (gameSession) {
        try {
          const historyId = gameSession.gameHistoryId;
          const playerAction: PlayerAction = {
            gameId: gameState.gameid,
            playerId,
            actionType: targetPiece ? "capture" : "move",
            from: [from.row, from.col],
            to: [finalDestination.row, finalDestination.col],
            timestamp: Date.now(),
            sequenceNumber: Date.now(), // Use timestamp as sequence number for now
          };
          const playerActionId = `${historyId}-${playerAction.timestamp}`;
          await gameHistoryService.addPlayerAction(historyId, playerActionId);
        } catch (actionError) {
          console.warn("Failed to record player action:", actionError);
        }
      }

      // Broadcasting disabled

      // Check for game over and switch turns
      const isGameOver = await checkGameOver(newBoard);
      if (!isGameOver) {
        if (isAI) {
          setCurrentPlayer("white");
        } else {
          setCurrentPlayer("black");
          setTimeout(() => makeAIMove(newBoard), 600);
        }
      }
    } catch (error) {
      console.error("Move error:", error);
      toast({ title: "Error", description: "Failed to process move.", variant: "destructive" });
    }
    finally {
      isProcessingMoveRef.current = false;
    }
  };

  /** Execute an AI move (local heuristic for Enhanced RPG) */
  const makeAIMove = async (currentBoard: (EnhancedRPGPiece | null)[][]) => {
    try {
      const isEnemyPiece = (p: EnhancedRPGPiece | null) => !!p && (p.id === 'RPGBOTID' || p.color === 'black');
      const enemyPieces = currentBoard
        .flat()
        .filter((p): p is EnhancedRPGPiece => isEnemyPiece(p));
      const playerPieces = currentBoard
        .flat()
        .filter((p): p is EnhancedRPGPiece => p !== null && !isEnemyPiece(p));
      const enemyByIdCount = currentBoard.flat().filter((p) => p && (p as any).id === 'RPGBOTID').length;
      const enemyBlackCount = currentBoard.flat().filter((p) => p && (p as any).color === 'black').length;
      console.log('[EnhancedRPG] Enemy counts', { enemyByIdCount, enemyBlackCount });

      const strategy = await AIService.getAIStrategy(gameState.currentRound, gameState.playerArmy.length);
      console.log('[EnhancedRPG] Using AI strategy', strategy);

      const aiMove = await AIService.calculateAIMove(
        currentBoard,
        enemyPieces,
        playerPieces,
        strategy,
        gameState.boardSize,
        gameState.currentRound,
        gameState.gameid,
        "ENHANCED_RPG",
        JwtService.getKeycloakId(),
        difficulty
      );

      if (aiMove) {
        const { from, to } = aiMove;
        console.log('[EnhancedRPG] AI suggested move', { from, to });
        const inBounds = (p: BoardPosition) => p.row >= 0 && p.row < gameState.boardSize && p.col >= 0 && p.col < gameState.boardSize;
        const fromPiece = inBounds(from) ? currentBoard[from.row][from.col] : null;
        if (fromPiece && isEnemyPiece(fromPiece)) {
          const targetAtTo = inBounds(to) ? currentBoard[to.row][to.col] : null;
          // Prefer capture moves to trigger damage. If suggested move isn't a capture, try to find any capture.
          if (!(targetAtTo && !isEnemyPiece(targetAtTo))) {
            const captureCandidates: { from: BoardPosition; to: BoardPosition }[] = [];
            for (let row = 0; row < gameState.boardSize; row++) {
              for (let col = 0; col < gameState.boardSize; col++) {
                const piece = currentBoard[row][col];
                if (isEnemyPiece(piece)) {
                  const moves = calculateRPGValidMoves({ row, col }, currentBoard, 'black', gameState.boardSize);
                  for (const m of moves) {
                    const target = currentBoard[m.row][m.col];
                    if (target && !isEnemyPiece(target)) {
                      captureCandidates.push({ from: { row, col }, to: m });
                    }
                  }
                }
              }
            }
            if (captureCandidates.length > 0) {
              const chosen = captureCandidates[Math.floor(Math.random() * captureCandidates.length)];
              console.log('[EnhancedRPG] AI overriding to capture move', chosen);
              await makeEnhancedMove(chosen.from, chosen.to, true, currentBoard);
              return;
            }
          }
          console.log(`AI moving from [${from.row}, ${from.col}] to [${to.row}, ${to.col}]`);
          await makeEnhancedMove(from, to, true, currentBoard);
        } else {
          console.warn('[EnhancedRPG] AI move invalid or piece missing; selecting fallback RPGBOTID/black move', {
            inBounds: inBounds(from),
            fromPiece,
          });
          const possibleMoves: { from: BoardPosition; to: BoardPosition }[] = [];
          for (let row = 0; row < gameState.boardSize; row++) {
            for (let col = 0; col < gameState.boardSize; col++) {
              const piece = currentBoard[row][col];
              if (isEnemyPiece(piece)) {
                const pieceColor = piece.color as PieceColor;
                const moves = calculateRPGValidMoves({ row, col }, currentBoard, pieceColor, gameState.boardSize);
                moves.forEach((m) => possibleMoves.push({ from: { row, col }, to: m }));
              }
            }
          }
          console.log('[EnhancedRPG] Fallback move candidates', possibleMoves.length);
          if (possibleMoves.length === 0) {
            // Secondary fallback: try strictly color-based black pieces in case IDs differ
            for (let row = 0; row < gameState.boardSize; row++) {
              for (let col = 0; col < gameState.boardSize; col++) {
                const piece = currentBoard[row][col];
                if (piece && piece.color === 'black') {
                  const moves = calculateRPGValidMoves({ row, col }, currentBoard, 'black', gameState.boardSize);
                  moves.forEach((m) => possibleMoves.push({ from: { row, col }, to: m }));
                }
              }
            }
            console.log('[EnhancedRPG] Secondary fallback candidates', possibleMoves.length);
          }
          if (possibleMoves.length > 0) {
            const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
            console.log('[EnhancedRPG] Executing fallback move', randomMove);
            await makeEnhancedMove(randomMove.from, randomMove.to, true, currentBoard);
          } else {
            console.log("No fallback AI moves available");
          }
        }
      } else {
        console.log("No AI move available");
        // Handle game over or stalemate
        setGameOver(true);
        setWinner("white"); // Player wins if AI has no moves
        onBattleComplete(true);
      }
    } catch (error) {
      console.error("[EnhancedRPG] AI move error:", error);
      toast({
        title: "AI Error",
        description: "Failed to process AI move. Using fallback.",
        variant: "destructive"
      });

      // Fallback to simple random move
      const possibleMoves: { from: BoardPosition; to: BoardPosition }[] = [];
      for (let row = 0; row < gameState.boardSize; row++) {
        for (let col = 0; col < gameState.boardSize; col++) {
          const piece = currentBoard[row][col];
          if (piece && piece.color === "black") {
            const moves = calculateRPGValidMoves(
              { row, col },
              currentBoard,
              "black",
              gameState.boardSize
            );
            moves.forEach((m) => possibleMoves.push({ from: { row, col }, to: m }));
          }
        }
      }

      if (possibleMoves.length > 0) {
        const randomMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        await makeEnhancedMove(randomMove.from, randomMove.to, true);
      }
    }
  };

  /** Generate a basic enemy army if none exists in server state */
  const generateDefaultEnemyArmy = (boardSize: number): EnhancedRPGPiece[] => {
    const pieces: EnhancedRPGPiece[] = [];

    const customEnemyNames = [
      "Obsidian Guard",
      "Shadow Knight",
      "Cursed Bishop",
      "Dark Queen",
      "Shadow King",
      "Void Bishop",
      "Night Knight",
      "Iron Guard",
      "Joker",
      "Forger",
      "Necromancer",
      "Berserker",
      "Alchemist",
      "Time Mage",
      "Summoner",
      "Illusionist",
      "Goblin Chief",
      "Orc Warlord",
      "Lich King",
      "Dragon Lord",
      "Troll King",
      "Vampire Count",
      "Demon Prince",
      "Fallen Angel",
      "Phoenix",
      "Griffin",
      "Wyvern",
      "Elemental",
      "Warlock",
      "Paladin",
      "Ranger",
      "Bard",
    ];

    const customPawnNames = [
      "Shadow Pawn",
      "Dark Warrior",
      "Void Soldier",
      "Night Guard",
      "Cursed Footman",
      "Iron Soldier",
      "Shadow Warrior",
      "Dark Footman",
      "Joker Pawn",
      "Forger Apprentice",
      "Necromancer Initiate",
      "Berserker Rookie",
      "Alchemist Novice",
      "Time Apprentice",
      "Summoner Trainee",
      "Illusionist Student",
      "Goblin",
      "Orc",
      "Lich",
      "Dragon",
      "Troll",
      "Vampire",
      "Demon",
      "Angel",
      "Phoenix",
      "Griffin",
      "Wyvern",
      "Elemental",
      "Warlock",
      "Paladin",
      "Ranger",
      "Bard",
    ];

    const addPiece = (type: string, row: number, col: number, customName: string) =>
      pieces.push({
        id: `${type}-${row}-${col}-${Math.random().toString(36).slice(2)}`,
        type: type as any,
        color: "black",
        name: customName,
        description: `A powerful ${type} with dark powers`,
        specialAbility: "Dark Magic",
        hp: 10,
        maxHp: 10,
        attack: 5,
        defense: 5,
        rarity: "common",
        pluscurrentHp: 10,
        plusmaxHp: 10,
        plusattack: 5,
        plusdefense: 5,
        pluslevel: 1,
        plusexperience: 0,
        position: { row, col },
        hasMoved: false,
      } as EnhancedRPGPiece);

    // Pawns on row 1
    for (let c = 0; c < Math.min(boardSize, 8); c++) addPiece("pawn", 1, c, customPawnNames[c] || "Shadow Pawn");
    // Back rank basics on row 0
    const backRank = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
    for (let c = 0; c < Math.min(boardSize, 8); c++) addPiece(backRank[c], 0, c, customEnemyNames[c] || `Enemy ${backRank[c]}`);
    return pieces;
  };

  /** Get special effects for a square */
  const getSquareEffect = (row: number, col: number): string | undefined => {
    const portal = teleportPortals.find((p) => p.position.row === row && p.position.col === col && p.isActive);
    return portal ? "teleport" : undefined;
  };

  /** Adjust zoom level for large boards */
  const adjustZoom = (delta: number) => {
    setZoomLevel((prev) => Math.max(0.5, Math.min(2, prev + delta)));
  };

  return (
    <div className="max-w-full mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBackToPreparation}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Preparation
        </Button>

        <div className="text-center">
          <h2 className="text-xl font-bold">Round {gameState.currentRound}</h2>
          <p className="text-sm text-muted-foreground">
            {gameOver
              ? winner === "white"
                ? "🏆 Victory!"
                : "💀 Defeat!"
              : `${currentPlayer === "white" ? "Your" : "Enemy's"} Turn`}
          </p>
          <Badge variant="outline">
            Board: {gameState.boardSize}x{gameState.boardSize}
          </Badge>
          <Badge variant="outline">Portals: {teleportPortals.filter((p) => p.isActive).length / 2}</Badge>
          <Badge variant="outline">Difficulty: {difficulty}</Badge>
        </div>

        <div className="flex gap-2">
          {needsDragging && (
            <>
              <Button variant="outline" size="sm" onClick={() => adjustZoom(-0.1)}>
                <ZoomOut className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => adjustZoom(0.1)}>
                <ZoomIn className="h-4 w-4" />
              </Button>
            </>
          )}
          <Button variant="outline" onClick={initializeEnhancedBoard} disabled={isLoading}>
            <RotateCw className="h-4 w-4 mr-2" />
            Reset
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
        </CardHeader>
        <CardContent className="flex justify-center items-center p-8 min-h-[600px]">
          <div
            ref={boardRef}
            className={`relative ${needsDragging ? "cursor-grab active:cursor-grabbing" : ""}`}
            style={{
              width: needsDragging ? `${maxBoardDisplaySize}px` : `${gameState.boardSize * squareSize}px`,
              height: needsDragging ? `${maxBoardDisplaySize}px` : `${gameState.boardSize * squareSize}px`,
              overflow: needsDragging ? "hidden" : "visible",
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <div
              className="grid gap-0 border-2 border-accent transition-transform duration-200"
              style={{
                gridTemplateColumns: `repeat(${gameState.boardSize}, minmax(0, 1fr))`,
                transform: needsDragging
                  ? `translate(${boardOffset.x}px, ${boardOffset.y}px) scale(${zoomLevel})`
                  : "none",
                transformOrigin: "top left",
              }}
            >
              {board.map((row, rowIndex) =>
                row.map((piece, colIndex) => {
                  const isLight = (rowIndex + colIndex) % 2 === 0;
                  const isSelected = selectedSquare?.row === rowIndex && selectedSquare?.col === colIndex;
                  const isValidMove = validMoves.some((m) => m.row === rowIndex && m.col === colIndex);
                  const specialEffect = getSquareEffect(rowIndex, colIndex);

                  return (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      style={{ width: `${squareSize}px`, height: `${squareSize}px` }}
                    >
                      <ChessSquare
                        row={rowIndex}
                        col={colIndex}
                        piece={piece}
                        isLight={isLight}
                        isSelected={isSelected}
                        isValidMove={isValidMove}
                        isCheck={false}
                        actualRowIndex={rowIndex}
                        actualColIndex={colIndex}
                        onClick={handleSquareClick}
                        specialEffect={specialEffect}
                        gameId={gameState.gameid}
                        playerId={JwtService.getKeycloakId() || gameSession?.whitePlayer.userId}
                        gameMode="ENHANCED_RPG"
                      />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>⚔️ Battle Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-bold text-blue-600">Your Army</h4>
              {board
                .flat()
                .filter((piece) => piece && piece.color === "white")
                .map((piece, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{piece!.name}</span>
                    <span className="text-green-600">
                      {piece!.pluscurrentHp}/{piece!.plusmaxHp} HP
                    </span>
                  </div>
                ))}
            </div>
            <div>
              <h4 className="font-bold text-red-600">Enemy Army</h4>
              {board
                .flat()
                .filter((piece) => piece && piece.color === "black")
                .map((piece, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{piece!.name}</span>
                    <span className="text-red-600">
                      {piece!.pluscurrentHp}/{piece!.plusmaxHp} HP
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {gameOver && (
        <Card>
          <CardContent className="text-center p-6">
            <h3 className="text-2xl font-bold mb-2">
              {winner === "white" ? "🏆 Victory!" : "💀 Defeat!"}
            </h3>
            <p className="text-muted-foreground mb-4">
              {winner === "white"
                ? "You have conquered the enhanced enemy army!"
                : "Your army was overwhelmed by the enemy forces..."}
            </p>
            <div className="flex gap-2 justify-center">
              <Button onClick={initializeEnhancedBoard} variant="outline" disabled={isLoading}>
                Try Again
              </Button>
              <Button onClick={onBackToPreparation}>Return to Adventure</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default EnhancedRPGChessBoard;
