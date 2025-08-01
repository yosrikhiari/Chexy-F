import React, { useState, useEffect, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { EnhancedGameState, EnhancedRPGPiece, TeleportPortal, CombatResult } from "@/Interfaces/types/enhancedRpgChess.ts";
import { BoardPosition, PieceColor, Piece } from "@/Interfaces/types/chess.ts";
import { RPGPiece } from "@/Interfaces/types/rpgChess.ts";
import { calculateValidMoves } from "@/utils/chessUtils.ts";
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
import { realtimeService } from "@/services/RealtimeService.ts";
import { enhancedRPGService } from "@/services/EnhancedRPGService.ts";
import {aiserervice} from "@/services/aiService.ts";

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

  // Drag and viewport state for large boards
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [boardOffset, setBoardOffset] = useState({ x: 0, y: 0 });
  const [zoomLevel, setZoomLevel] = useState(1);

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

  /** Initialize the board with player and enemy pieces, and set up teleport portals */
  const initializeEnhancedBoard = async () => {
    try {
      setIsLoading(true);
      const session = await gameSessionService.getGameSession(gameState.gameid);
      setGameSession(session);

      let newBoard: (EnhancedRPGPiece | null)[][];

      // Fetch RPG game state for consistency
      const rpgState = await rpgGameService.getRPGGame(gameState.gameid);

      if (session.board && isEnhancedRPGPieceArray(session.board)) {
        newBoard = session.board.map((row) => row.map((piece) => (piece ? convertToEnhancedRPGPiece(piece) : null)));
      } else {
        const size = gameState.boardSize;
        newBoard = Array(size)
          .fill(null)
          .map(() => Array(size).fill(null));

        // Place player pieces
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
          : await aiserervice.generateEnemyArmy(gameState.currentRound, size);
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

        // Update backend with initial board state
        await gameService.executeMove(gameState.gameid, { from: { row: 0, col: 0 }, to: { row: 0, col: 0 } });
      }

      // Generate teleport portals
      const portalCount = calculateTeleportPortals(gameState.boardSize);
      const rawPortals = await generateTeleportPortals(gameState.gameid,currentPlayer, gameState.boardSize, portalCount);
      const portals: TeleportPortal[] = rawPortals.map((p) => {
        const linkedPortal = rawPortals.find((lp) => lp.id === p.linkedPortal);
        return {
          id: p.id || `portal-${Math.random().toString(36).slice(2)}`,
          position: { row: p.position[0], col: p.position[1] },
          to: linkedPortal ? { row: linkedPortal.position[0], col: linkedPortal.position[1] } : { row: p.position[0], col: p.position[1] },
          linkedPortal: p.linkedPortal,
          isActive: true,
        };
      });
      setTeleportPortals(portals);

      const playerId = JwtService.getKeycloakId() || session.whitePlayer.userId || "";
      await rpgGameService.addBoardEffect(
        gameState.gameid,
        {
          id: `teleport-${Date.now()}`,
          name: "Teleport Portals",
          description: "Allows pieces to teleport between linked portals",
          effect: "add_portal_pairs",
          rarity: "rare",
          specialTiles: portalCount,
          isActive: true,
        },
        playerId
      );

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
    if (gameOver || isDragging || isLoading) return;

    const clickedPiece = board[row][col];

    if (!selectedSquare) {
      if (clickedPiece && clickedPiece.color === currentPlayer) {
        setSelectedSquare({ row, col });
        const moves = await calculateValidMoves({ row, col }, board, currentPlayer, gameState.gameid, gameSession.gameMode,gameState.boardSize);
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
      const moves = await calculateValidMoves({ row, col }, board, currentPlayer, gameState.gameid, gameSession.gameMode,gameState.boardSize);
      setValidMoves(moves);
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  /** Execute a move, including combat and teleportation */
  const makeEnhancedMove = async (from: BoardPosition, to: BoardPosition) => {
    try {
      const movingPiece = board[from.row][from.col];
      if (!movingPiece || movingPiece.color !== currentPlayer) return;

      const isValid = await chessGameService.validateMove(gameState.gameid, { row: from.row,col: from.col, torow:to.row,tocol:to.col });
      if (!isValid) {
        toast({ title: "Invalid Move", description: "This move is not allowed.", variant: "destructive" });
        return;
      }

      const newBoard = board.map((row) => [...row]);
      const targetPiece = newBoard[to.row][to.col];
      let finalDestination = to;

      const playerId = JwtService.getKeycloakId() || gameSession?.whitePlayer.userId || "player1";

      // Handle combat
      if (targetPiece && targetPiece.color !== movingPiece.color) {
        const combatResult: CombatResult = await enhancedRPGService.resolveCombat(movingPiece, targetPiece, gameState.gameid, playerId);
        if (combatResult.defenderDefeated) {
          newBoard[to.row][to.col] = null;
          newBoard[from.row][from.col] = {
            ...movingPiece,
            plusexperience: (movingPiece.plusexperience || 0) + 10,
            position: to,
          };
          toast({ title: "Combat Victory", description: `${targetPiece.name} was defeated!` });
        } else {
          newBoard[to.row][to.col] = {
            ...targetPiece,
            pluscurrentHp: targetPiece.pluscurrentHp - combatResult.damage,
          };
          toast({
            title: "Combat",
            description: `${targetPiece.name} survived with ${targetPiece.pluscurrentHp - combatResult.damage} HP!`,
          });
        }

        if (combatResult.attackerCounterDamage && movingPiece.pluscurrentHp <= combatResult.attackerCounterDamage) {
          newBoard[from.row][from.col] = null;
          setBoard(newBoard);
          await checkGameOver(newBoard);
          if (!gameOver) setCurrentPlayer(currentPlayer === "white" ? "black" : "white");
          return;
        }
      }

      // Handle teleport portal
      const portal = teleportPortals.find((p) => p.position.row === to.row && p.position.col === to.col && p.isActive);
      if (portal && portal.to) {
        finalDestination = portal.to;
        setTeleportPortals((prev) =>
          prev.map((p) => (p.id === portal.id || p.id === portal.linkedPortal ? { ...p, isActive: false } : p))
        );
      }

      await gameService.executeMove(gameState.gameid, { from, to: finalDestination });
      newBoard[finalDestination.row][finalDestination.col] = { ...movingPiece, position: finalDestination };
      newBoard[from.row][from.col] = null;
      setBoard(newBoard);

      // Record player action
      if (!gameSession) {
        toast({ title: "Error", description: "Game session not initialized.", variant: "destructive" });
        return;
      }
      const historyId = gameSession.gameHistoryId;
      const playerAction: PlayerAction = {
        gameId: gameState.gameid,
        playerId,
        actionType: targetPiece ? "capture" : "move",
        from: [from.row, from.col],
        to: [finalDestination.row, finalDestination.col],
        timestamp: Date.now(),
      };
      const playerActionId = `${historyId}-${playerAction.timestamp}`;
      await gameHistoryService.addPlayerAction(historyId, playerActionId);

      await realtimeService.broadcastGameState(gameState.gameid);

      const isGameOver = await checkGameOver(newBoard);
      if (!isGameOver) {
        setCurrentPlayer(currentPlayer === "white" ? "black" : "white");
        if (currentPlayer === "white") {
          setTimeout(() => makeAIMove(newBoard), 1000);
        }
      }
    } catch (error) {
      console.error("Move error:", error);
      toast({ title: "Error", description: "Failed to process move.", variant: "destructive" });
    }
  };

  /** Execute an AI move */
  const makeAIMove = async (currentBoard: (EnhancedRPGPiece | null)[][]) => {
    try {
      const enemyPieces = currentBoard.flat().filter((piece) => piece && piece.color === "black") as EnhancedRPGPiece[];
      const playerPieces = currentBoard.flat().filter((piece) => piece && piece.color === "white") as EnhancedRPGPiece[];
      const aiMove = await aiserervice.calculateAIMove(
        currentBoard,
        enemyPieces,
        playerPieces,
        gameState.aiStrategy,
        gameState.boardSize,
        gameState.currentRound,
        gameState.gameid,
        "ENHANCED_RPG",
        gameSession?.blackPlayer.userId
      );

      if (aiMove) {
        await makeEnhancedMove(aiMove.from, aiMove.to);
      } else {
        toast({ title: "AI Move", description: "No valid move available for AI.", variant: "default" });
      }
    } catch (error) {
      console.error("AI move error:", error);
      toast({ title: "Error", description: "Failed to process AI move.", variant: "destructive" });
    }
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
          <CardTitle className="flex items-center gap-2">
            🏟️ Enhanced Battle Arena
            {needsDragging && (
              <Badge variant="secondary">
                <Move className="h-3 w-3 mr-1" />
                Drag to Navigate
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-hidden">
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
