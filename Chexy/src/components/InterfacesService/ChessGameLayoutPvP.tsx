import React, {useState, useEffect, useRef} from "react";
import { useNavigate, useParams } from "react-router-dom";
import GameControls from "./GameControls.tsx";
import PlayerInfo from "./PlayerInfo.tsx";
import ChessTimer from "./ChessTimer.tsx";
import GameEndModal from "./GameEndModal.tsx";
import { PieceColor, GameTimers, GameState, GameResult, PlayerStats, PieceType, BoardPosition } from "@/Interfaces/types/chess.ts";
import { toast } from "@/components/ui/use-toast.tsx";
import { userService} from "@/services/UserService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { gameHistoryService } from "@/services/GameHistoryService.ts";
import { JwtService } from "@/services/JwtService.ts";
import ChessBoardPvP from "@/components/InterfacesService/ChessBoardPvP.tsx";
import { PlayerAction } from "@/Interfaces/services/PlayerAction.ts";
import { chessGameService } from "@/services/ChessGameService.ts";
import {PointCalculationService} from "@/utils/PointsCalculatorService.ts";
import { normalizePlayer } from "@/utils/sessionUtils.ts";


interface ChessGameLayoutPvPProps {
  className?: string;
  isRankedMatch: boolean;
}

type ExtendedPlayerAction = PlayerAction & {
  pieceType: PieceType;
  playerColor: PieceColor;
  resultsInCheck?: boolean;
  resultsInCheckmate?: boolean;
  resultsInStalemate?: boolean;
};

const normalizePlayerData = normalizePlayer as any;

const ChessGameLayoutPvP: React.FC<ChessGameLayoutPvPProps> = ({
                                                                 className = "",
                                                                 isRankedMatch,
                                                               }) => {
  const [isOn, setIsOn] = useState(false);
  const { gameId } = useParams<{ gameId: string }>();
  const navigate = useNavigate();
  const [currentPlayer, setCurrentPlayer] = useState<PieceColor>("white");
  const [gameState, setGameState] = useState<GameState>({
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
  const [timers, setTimers] = useState<GameTimers | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isReviewMode] = useState(false);
  const gameEndProcessedRef = useRef(false);
  const [playerStats, setPlayerStats] = useState<{
    white: PlayerStats;
    black: PlayerStats;
  }>({
    white: { playerId: "", name: "White", points: 0 },
    black: { playerId: "", name: "Black", points: 0 },
  });
  const [isLoading, setIsLoading] = useState(true);
  const [localMoveHistory, setLocalMoveHistory] = useState<ExtendedPlayerAction[]>([]);
  const [playerId, setPlayerId] = useState<string>("");
  const [playerColor, setPlayerColor] = useState<PieceColor>("white");
  const [flipped, setFlipped] = useState(false);
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  const [initialPoints, setInitialPoints] = useState<number | null>(null);
  const [forcedPointsDelta, setForcedPointsDelta] = useState<number | null>(null);
  const [allowSpectators, setAllowSpectators] = useState<boolean>(true);

  const moveToAlgebraicNotation = (action: ExtendedPlayerAction): string => {
    if (!action || !action.from || !action.to ||
      !Array.isArray(action.from) || !Array.isArray(action.to) ||
      action.from.length !== 2 || action.to.length !== 2) {
      return "Move";
    }

    const pieceMap: { [key: string]: string } = {
      king: "K", queen: "Q", rook: "R", bishop: "B", knight: "N", pawn: "",
    };

    const fromCol = String.fromCharCode(97 + action.from[1]);
    const toCol = String.fromCharCode(97 + action.to[1]);
    const toRow = 8 - action.to[0];
    const pieceType = action.pieceType || "pawn";
    const isCapture = action.actionType === "capture";

    let notation = '';
    if (pieceType === 'pawn') {
      if (isCapture) {
        notation = `${fromCol}x${toCol}${toRow}`;
      } else {
        notation = `${toCol}${toRow}`;
      }
    } else {
      notation = `${pieceMap[pieceType]}${isCapture ? 'x' : ''}${toCol}${toRow}`;
    }

    if (action.resultsInCheckmate) notation += "#";
    else if (action.resultsInCheck) notation += "+";
    else if (action.resultsInStalemate) notation += " (stalemate)";
    return notation;
  };

  const determinePlayerColor = (actionPlayerId: string): PieceColor => {
    if (actionPlayerId === playerStats.white.playerId) {
      return "white";
    } else if (actionPlayerId === playerStats.black.playerId) {
      return "black";
    }
    if (actionPlayerId === gameState.userId1) {
      return "white";
    } else if (actionPlayerId === gameState.userId2) {
      return "black";
    }
    return "white";
  };

  const determinePieceType = (actionType: string, fromX: number, fromY: number, toX: number, toY: number): PieceType => {
    if (actionType === "DOUBLE_PAWN_PUSH") {
      return "pawn";
    }

    const rowDiff = Math.abs(toX - fromX);
    const colDiff = Math.abs(toY - fromY);

    if (colDiff === 0 && (rowDiff === 1 || rowDiff === 2)) {
      return "pawn";
    }

    if (rowDiff === 1 && colDiff === 1 && actionType === "CAPTURE") {
      return "pawn";
    }

    if ((rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2)) {
      return "knight";
    }

    if (rowDiff === colDiff && rowDiff > 0) {
      return "bishop";
    }

    if ((rowDiff === 0 && colDiff > 0) || (colDiff === 0 && rowDiff > 0)) {
      return "rook";
    }

    if (rowDiff <= 1 && colDiff <= 1 && (rowDiff + colDiff) > 0) {
      return "king";
    }

    if ((rowDiff === colDiff) || (rowDiff === 0) || (colDiff === 0)) {
      return "queen";
    }

    return "pawn";
  };

  interface ServerPlayerAction {
    gameSessionId: string;
    playerId: string;
    actionType: string; // "CAPTURE", "MOVE", etc.
    fromX: number;
    fromY: number;
    toX: number;
    toY: number;
    timestamp: string | number;
    sequenceNumber?: number;
    pieceType?: PieceType;
    resultsInCheck?: boolean;
    resultsInCheckmate?: boolean;
    resultsInStalemate?: boolean;
  }

  const loadMoveHistoryFromServer = async () => {
    if (!gameId) return;

    try {
      // Cast the response to handle both server and client formats
      const playerActions = await gameHistoryService.getPlayerActions(gameId) as (ServerPlayerAction | ExtendedPlayerAction)[];

      const extendedActions: ExtendedPlayerAction[] = playerActions
        .filter(action => {
          // Check if action has the expected server format (fromX, fromY, toX, toY)
          // OR the client format (from, to arrays)
          const hasServerFormat = action &&
            'fromX' in action && 'fromY' in action && 'toX' in action && 'toY' in action &&
            typeof (action as ServerPlayerAction).fromX === 'number' &&
            typeof (action as ServerPlayerAction).fromY === 'number' &&
            typeof (action as ServerPlayerAction).toX === 'number' &&
            typeof (action as ServerPlayerAction).toY === 'number';

          const hasClientFormat = action &&
            'from' in action && 'to' in action &&
            Array.isArray((action as ExtendedPlayerAction).from) && (action as ExtendedPlayerAction).from.length === 2 &&
            Array.isArray((action as ExtendedPlayerAction).to) && (action as ExtendedPlayerAction).to.length === 2;

          return (hasServerFormat || hasClientFormat) &&
            action.playerId &&
            ('gameSessionId' in action || 'gameId' in action);
        })
        .map(action => {
          // Handle both server format (fromX, fromY, toX, toY) and client format (from[], to[])
          let fromCoords: [number, number];
          let toCoords: [number, number];
          let actionType: "move" | "capture" | "ability";
          let gameId: string;

          if ('fromX' in action) {
            // Server format
            const serverAction = action as ServerPlayerAction;
            fromCoords = [serverAction.fromX, serverAction.fromY];
            toCoords = [serverAction.toX, serverAction.toY];
            actionType = serverAction.actionType === "capture" ? "capture" : "move";
            gameId = serverAction.gameSessionId;
          } else {
            // Client format (already in correct format)
            const clientAction = action as ExtendedPlayerAction;
            fromCoords = clientAction.from;
            toCoords = clientAction.to;
            actionType = clientAction.actionType;
            gameId = clientAction.gameId;
          }

          const convertedAction: ExtendedPlayerAction = {
            gameId: gameId,
            playerId: action.playerId,
            playerColor: determinePlayerColor(action.playerId),
            actionType: actionType,
            from: fromCoords,
            to: toCoords,
            timestamp: typeof action.timestamp === 'number' ? action.timestamp : new Date(action.timestamp).getTime(),
            sequenceNumber: ('sequenceNumber' in action && action.sequenceNumber) ? action.sequenceNumber : 0,
            pieceType: ('pieceType' in action && action.pieceType) ? action.pieceType : determinePieceType(
              actionType === "capture" ? "CAPTURE" : "MOVE",
              fromCoords[0],
              fromCoords[1],
              toCoords[0],
              toCoords[1]
            ),
            resultsInCheck: ('resultsInCheck' in action && action.resultsInCheck) || false,
            resultsInCheckmate: ('resultsInCheckmate' in action && action.resultsInCheckmate) || false,
            resultsInStalemate: ('resultsInStalemate' in action && action.resultsInStalemate) || false,
          };

          return convertedAction;
        });

      extendedActions.sort((a, b) => a.timestamp - b.timestamp);
      setLocalMoveHistory(extendedActions);
      localStorage.setItem(`moveHistory_${gameId}`, JSON.stringify(extendedActions));

    } catch (error) {
      console.warn("Failed to load move history from server:", error);
      const savedMoveHistory = localStorage.getItem(`moveHistory_${gameId}`);
      if (savedMoveHistory) {
        try {
          const parsedHistory = JSON.parse(savedMoveHistory);
          const filteredHistory = parsedHistory.filter((action: any) => {
            return action &&
              action.from && Array.isArray(action.from) && action.from.length === 2 &&
              action.to && Array.isArray(action.to) && action.to.length === 2 &&
              action.playerColor;
          });
          setLocalMoveHistory(filteredHistory);
        } catch (parseError) {
          setLocalMoveHistory([]);
        }
      } else {
        setLocalMoveHistory([]);
      }
    }
  };

  useEffect(() => {
    if (!gameId) return;
    const iv = setInterval(async () => {
      try {
        const session = await gameSessionService.getGameSession(gameId);
        setAllowSpectators(!!session.allowSpectators);
      } catch {}
    }, 5000);
    return () => clearInterval(iv);
  }, [gameId]);

  useEffect(() => {
    gameEndProcessedRef.current = false;
  }, [gameId]);

  useEffect(() => {
    if (!gameId) {
      navigate("/lobby");
      return;
    }

    const initializeGame = async () => {
      try {
        setIsLoading(true);
         const session = await gameSessionService.getGameSession(gameId);

        if (session.status === 'COMPLETED' || session.status === 'TIMEOUT') {
          toast({
            title: "Game Over",
            description: "This game has already ended.",
            variant: "destructive",
          });
          navigate("/lobby");
          return;
        }

        const normalizedWhitePlayer = normalizePlayerData(session.whitePlayer);
        const normalizedBlackPlayer = normalizePlayerData(session.blackPlayer);

        if (!normalizedWhitePlayer) {
          throw new Error("White player data is missing");
        }

        const currentUserId = (await userService.getCurrentUser(JwtService.getKeycloakId())).id;
        const myColor = normalizedWhitePlayer.userId === currentUserId ? "white" : "black";

        setPlayerColor(myColor);
        setPlayerId(currentUserId);
        setFlipped(myColor === "black");

        // Fetch initial points
        const user = await userService.getCurrentUser(JwtService.getKeycloakId());
        setInitialPoints(user.points);

        setGameState({
          ...session.gameState,
          gameSessionId: gameId,
          userId1: normalizedWhitePlayer.userId,
          userId2: normalizedBlackPlayer?.userId || "",
          // Defensive: ensure flags exist so end checks work
          isCheck: !!session.gameState?.isCheck,
          isCheckmate: !!session.gameState?.isCheckmate,
          isDraw: !!session.gameState?.isDraw,
        });

        setCurrentPlayer(session.gameState.currentTurn);

        // Fetch actual user points for both players
        const whiteUser = await userService.getByUserId(normalizedWhitePlayer.userId);
        const blackUser = normalizedBlackPlayer?.userId ? await userService.getByUserId(normalizedBlackPlayer.userId) : null;

        setPlayerStats({
          white: {
            playerId: normalizedWhitePlayer.userId,
            name: normalizedWhitePlayer.username || "White Player",
            points: whiteUser?.points || 0,
          },
          black: {
            playerId: normalizedBlackPlayer?.userId || "",
            name: normalizedBlackPlayer?.username || "Waiting for player...",
            points: blackUser?.points || 0,
          },
        });

        setTimers({
          white: {
            timeLeft: session.timers?.white?.timeLeft ?? 600,
            active: session.gameState.currentTurn === "white",
          },
          black: {
            timeLeft: session.timers?.black?.timeLeft ?? 600,
            active: session.gameState.currentTurn === "black",
          },
          defaultTime: session.timers?.defaultTime ?? 600,
        });

        await loadMoveHistoryFromServer();
      } catch (error) {
        console.error("Error initializing game:", error);
        toast({ title: "Error", description: "Failed to load game.", variant: "destructive" });
        navigate("/lobby");
      } finally {
        setIsLoading(false);
      }
    };

    initializeGame();
  }, [gameId, navigate]);


  // Poll for player points updates
  useEffect(() => {
    if (!gameId || isLoading || isGameOver || isReviewMode || gameResult !== null) {
      return;
    }

    const pollForPlayerUpdates = setInterval(async () => {
      try {
        // Refresh player points
        const whiteUser = await userService.getByUserId(playerStats.white.playerId);
        const blackUser = playerStats.black.playerId ? await userService.getByUserId(playerStats.black.playerId) : null;

        setPlayerStats(prev => ({
          white: {
            ...prev.white,
            points: whiteUser?.points || 0,
          },
          black: {
            ...prev.black,
            points: blackUser?.points || 0,
          },
        }));
      } catch (error) {
        console.error("Failed to refresh player points:", error);
      }
    }, 10000); // Poll every 10 seconds

    return () => clearInterval(pollForPlayerUpdates);
  }, [gameId, isLoading, isGameOver, isReviewMode, gameResult, playerStats.white.playerId, playerStats.black.playerId]);

  useEffect(() => {
    // Stop polling if game is over, still loading, in review mode, OR if we have a game result
    if (!gameId || isLoading || isGameOver || isReviewMode || gameResult !== null) {
      return;
    }

    const pollForUpdates = setInterval(async () => {
      // Double-check game over state before making API call
      if (isGameOver || isReviewMode || gameResult !== null || gameEndProcessedRef.current) {
        clearInterval(pollForUpdates);
        return;
      }

      try {
        const session = await gameSessionService.getGameSession(gameId);

        // IMPORTANT: Check if session status indicates game ended
        if (session.status === 'COMPLETED' || session.status === 'TIMEOUT') {
          clearInterval(pollForUpdates);
          console.log("[DEBUG] Game session completed, processing game end...");

          // Check if game end has already been processed
          if (gameEndProcessedRef.current) {
            console.log("[DEBUG] Game end already processed by polling, ignoring");
            return;
          }

          // Determine the winner from the session or game state
          let winner: PieceColor;
          let winnerName: string;
          let winnerId: string;
          let gameEndReason: "checkmate" | "timeout" | "resignation" | "draw" = "resignation";

          const endWhite = normalizePlayerData(session.whitePlayer);
          const endBlack = normalizePlayerData(session.blackPlayer);

          // Check if it's a draw first
          if (session.gameState?.isDraw) {
            winner = "draw" as any;
            winnerName = "Draw";
            winnerId = "";
            gameEndReason = "draw";
          }
          // Check for checkmate
          else if (session.gameState?.isCheckmate) {
            winner = session.gameState.checkedPlayer === "white" ? "black" : "white";
            winnerName = winner === "white" ? (endWhite?.username || playerStats.white.name) : (endBlack?.username || playerStats.black.name);
            // Prefer fresh session players; fallback to gameState
            winnerId = winner === "white" ? (endWhite?.userId || gameState.userId1) : (endBlack?.userId || gameState.userId2);
            gameEndReason = "checkmate";
          }
          // Check for timeout
          else if (session.status === 'TIMEOUT') {
            // Determine winner based on whose timer ran out
            winner = currentPlayer === "white" ? "black" : "white";
            winnerName = winner === "white" ? (endWhite?.username || playerStats.white.name) : (endBlack?.username || playerStats.black.name);
            // Prefer fresh session players; fallback to gameState
            winnerId = winner === "white" ? (endWhite?.userId || gameState.userId1) : (endBlack?.userId || gameState.userId2);
            gameEndReason = "timeout";
          }
          // Default case - attempt to derive winner from game history if available (handles resignation)
          else {
            try {
              const history = await gameHistoryService.getGameHistoriesBySession(gameId!);
              if (history && history.result) {
                const r = history.result as any;
                winner = r.winner;
                winnerName = r.winnerName;
                winnerId = r.winnerid;
                gameEndReason = r.gameEndReason || gameEndReason;
              } else {
                console.warn("[DEBUG] Unable to determine winner from session state; deferring end handling");
                return; // Keep polling or rely on explicit detectors like checkmate/timeout
              }
            } catch (e) {
              console.warn("[DEBUG] Could not fetch game history to determine winner; deferring", e);
              return;
            }
          }

          // Final winnerId fallback to prevent empty IDs causing both sides to get penalties
          if (!winnerId) {
            if (winner === "white") {
              winnerId = endWhite?.userId || gameState.userId1 || playerStats.white.playerId || "";
            } else if (winner === "black") {
              winnerId = endBlack?.userId || gameState.userId2 || playerStats.black.playerId || "";
            }
          }

          // As a final fallback, query the session directly for player IDs
          if (!winnerId) {
            try {
              const s = await gameSessionService.getGameSession(gameId!);
              const w = normalizePlayerData(s.whitePlayer);
              const b = normalizePlayerData(s.blackPlayer);
              if (winner === "white") winnerId = w?.userId || winnerId;
              if (winner === "black") winnerId = b?.userId || winnerId;
            } catch {}
          }

          const detectedGameResult: GameResult = {
            winner: winner,
            winnerName: winnerName,
            pointsAwarded: 0, // FIX: Always start with 0, let GameEndModal calculate if ranked
            gameEndReason: gameEndReason,
            gameid: gameState.gameSessionId,
            winnerid: winnerId, // FIX: Now properly set
          };
          // End the game locally
          console.log("[DEBUG] Polling detected game end, calling handleGameEnd");
          handleGameEnd(detectedGameResult, localMoveHistory.length);

          // Show notification to opponent
          toast({
            title: "Game Ended",
            description: gameEndReason === "timeout"
                ? "Game ended due to timeout"
                : gameEndReason === "draw"
                  ? "Game ended in a draw"
                  : "Game ended in checkmate",
            duration: 5000,
          });

          return;
        }

        const normalizedWhitePlayer = normalizePlayerData(session.whitePlayer);
        const normalizedBlackPlayer = normalizePlayerData(session.blackPlayer);

        if (normalizedBlackPlayer && playerStats.black.name === "Waiting for player...") {
          setPlayerStats(prev => ({
            ...prev,
            black: {
              playerId: normalizedBlackPlayer.userId,
              name: normalizedBlackPlayer.username || "Black Player",
              points: 0
            }
          }));

          setGameState(prev => ({
            ...prev,
            userId2: normalizedBlackPlayer.userId
          }));

          toast({
            title: "Player Joined",
            description: `${normalizedBlackPlayer.username || "Black player"} has joined the game!`,
            duration: 3000
          });
        }

        if (session.gameState.currentTurn !== currentPlayer) {
          setCurrentPlayer(session.gameState.currentTurn);
          await loadMoveHistoryFromServer();
        }

        // Preserve identifiers we enrich locally (userId1/userId2/gameSessionId)
        setGameState((prev) => ({
          ...session.gameState,
          gameSessionId: prev.gameSessionId || gameId!,
          userId1: prev.userId1,
          userId2: prev.userId2,
        }));

      } catch (error) {
        console.error("Error polling for updates:", error);
        // Stop polling on error as well
        clearInterval(pollForUpdates);
      }
    }, 2000);

    return () => clearInterval(pollForUpdates);
  }, [gameId, isLoading, playerStats.black.name, currentPlayer, isGameOver, isReviewMode, gameResult]);




  const handleGameEnd = async (result: GameResult, moveCount?: number) => {
    console.log("[DEBUG] Game ended:", result, "Move count:", moveCount, "Source: explicit call");

    if (gameEndProcessedRef.current) {
      console.log("[DEBUG] Game end already processed, ignoring");
      return;
    }
    if (isGameOver || gameResult !== null) {
      console.log("[DEBUG] Game already ended, ignoring");
      return;
    }

    gameEndProcessedRef.current = true;
    try {
      let correctedResult = { ...result };

      // CRITICAL: Ensure session players are known for winner calculation
      const keycloakId = JwtService.getKeycloakId();
      if (!keycloakId) {
        console.error("[ERROR] No keycloak ID available");
        return;
      }

      const sessionForIds = await gameSessionService.getGameSession(gameState.gameSessionId);
      const endWhite = normalizePlayerData(sessionForIds.whitePlayer);
      const endBlack = normalizePlayerData(sessionForIds.blackPlayer);
      const currentUser = await userService.getCurrentUser(keycloakId);
      const currentUserId = currentUser.id;

      // CRITICAL FIX: Comprehensive winnerId validation and fixing
      if (!correctedResult.winnerid && correctedResult.winner !== "draw") {
        console.error("[ERROR] Missing winnerId in game result:", correctedResult);

        if (correctedResult.winner === "white") {
          correctedResult.winnerid = endWhite?.userId || gameState.userId1 || playerStats.white.playerId || "";
        } else if (correctedResult.winner === "black") {
          correctedResult.winnerid = endBlack?.userId || gameState.userId2 || playerStats.black.playerId || "";
        }

        if (!correctedResult.winnerid) {
          console.error("[CRITICAL ERROR] Cannot determine winnerId after all attempts");
          correctedResult.winnerid = "";
          correctedResult.pointsAwarded = 0;
          setGameResult(correctedResult);
          setIsGameOver(true);
          setIsModalOpen(true);
          return;
        }
      }

      // Persist game end to backend to update stats
      try {
        await gameSessionService.endGame(
          correctedResult.gameid,
          correctedResult.winner !== "draw" ? correctedResult.winnerid : undefined,
          correctedResult.gameEndReason === "draw" || correctedResult.winner === "draw",
          undefined,
          "resignation"
        );
      } catch (persistErr) {
        console.error("[ERROR] Failed to persist game end to backend:", persistErr);
      }

      // Calculate points only for display; application is done on the server now
      try {
        const isDraw = correctedResult.winner === "draw" || correctedResult.gameEndReason === "draw";
        const winnerId = correctedResult.winnerid;
        // Use provided moveCount or fall back to localMoveHistory.length
        const effectiveMoveCount = moveCount !== undefined ? moveCount : localMoveHistory.length;

        // Points calculation debug info

        // No-op: server applies points. Keep display calculation below.

        // For UI: get the points that were already calculated and applied above
        const currentStreak = await PointCalculationService.getCurrentUserStreak();
        const isCurrentUserWinner = correctedResult.winnerid === currentUserId;
        const isCurrentUserDraw = correctedResult.winner === "draw" || correctedResult.gameEndReason === "draw";

        // Calculate points for display only (don't apply again)
        const pointsCalculation = PointCalculationService.calculateStreakBasedPoints(
          isCurrentUserWinner,
          isCurrentUserDraw,
          currentStreak,
          isRankedMatch,
          effectiveMoveCount
        );

        // Update game result with calculated points for UI display
        correctedResult = {
          ...correctedResult,
          pointsAwarded: pointsCalculation.pointsAwarded
        };

        // Immediately use idempotency cache delta when available; fallback to calculated points
        try {
          const idempotencyKeyNow = `points_processed:${correctedResult.gameid}:${currentUserId}`;
          const cached = localStorage.getItem(idempotencyKeyNow);

          if (cached) {
            const parsed = JSON.parse(cached);
            if (parsed && typeof parsed.delta === 'number') {
              setForcedPointsDelta(parsed.delta);
            } else {
              setForcedPointsDelta(correctedResult.pointsAwarded || 0);
            }
          } else {
            setForcedPointsDelta(correctedResult.pointsAwarded || 0);
          }
        } catch (error) {
          setForcedPointsDelta(correctedResult.pointsAwarded || 0);
        }
      } catch (error) {
        console.error("[ERROR] Failed to process streak-based points:", error);
        correctedResult.pointsAwarded = 0;
      }

      // Set local game state
      setGameResult(correctedResult);
      setIsGameOver(true);
      setIsModalOpen(true);

      setTimers((prev) => prev && ({
        ...prev,
        white: { ...prev.white, active: false },
        black: { ...prev.black, active: false },
      }));

      setGameState(prev => ({
        ...prev,
        isCheckmate: correctedResult.gameEndReason === "checkmate",
        isDraw: correctedResult.winner === "draw" || correctedResult.gameEndReason === "draw",
        currentTurn: prev.currentTurn
      }));

      // Refresh user data
      setTimeout(async () => {
        if (keycloakId) {
          try {
            const updatedUser = await userService.getCurrentUser(keycloakId);
            setTotalPoints(updatedUser.points);
            localStorage.setItem("user", JSON.stringify(updatedUser));
            console.log("[DEBUG] User data refreshed after game end:", updatedUser.points);
            // Reconcile forced delta: prefer idempotency cache delta; fallback to actual totals diff
            try {
              const idempotencyKeyAfter = `points_processed:${gameState.gameSessionId}:${updatedUser.id}`;
              const cachedAfter = localStorage.getItem(idempotencyKeyAfter);
              if (cachedAfter) {
                const parsedAfter = JSON.parse(cachedAfter);
                if (parsedAfter && typeof parsedAfter.delta === 'number') {
                  setForcedPointsDelta(parsedAfter.delta);
                } else if (initialPoints !== null) {
                  setForcedPointsDelta(updatedUser.points - initialPoints);
                }
              } else if (initialPoints !== null) {
                setForcedPointsDelta(updatedUser.points - initialPoints);
              }
            } catch {
              if (initialPoints !== null) {
                setForcedPointsDelta(updatedUser.points - initialPoints);
              }
            }
          } catch (error) {
            console.error("Failed to fetch updated user:", error);
          }
        }
      }, 1000);

      console.log("[DEBUG] Game end processing completed locally with winnerId:", correctedResult.winnerid);
    }
    catch (error) {
      console.error("[ERROR] Game end processing failed:", error);
      // Reset the flag if processing failed
      gameEndProcessedRef.current = false;
      throw error;
    }
  };

  const resetGame = () => {
    localStorage.removeItem(`moveHistory_${gameId}`);
    navigate("/lobby");
  };

  const handlePlayerChange = (color: PieceColor) => {
    // Don't allow player changes in review mode
    if (isReviewMode) return;

    setCurrentPlayer(color);
    if (!isGameOver && timers) {
      setTimers({
        ...timers,
        white: { ...timers.white, active: color === "white" },
        black: { ...timers.black, active: color === "black" },
      });
    }
  };

  const handleMoveMade = (move: {
    from: BoardPosition;
    to: BoardPosition;
    actionType: "move" | "capture";
    pieceType: PieceType;
    resultsInCheck?: boolean;
    resultsInCheckmate?: boolean;
    resultsInStalemate?: boolean;
  }) => {
    // Don't allow moves in review mode
    if (isReviewMode) return;

    const movingPlayerColor = currentPlayer;
    const movingPlayerId = currentPlayer === "white" ? gameState.userId1 : gameState.userId2;

    const newAction: ExtendedPlayerAction = {
      gameId: gameState.gameSessionId,
      playerId: movingPlayerId,
      playerColor: movingPlayerColor,
      actionType: move.actionType,
      from: [move.from.row, move.from.col],
      to: [move.to.row, move.to.col],
      timestamp: Date.now(),
      sequenceNumber: localMoveHistory.length + 1,
      pieceType: move.pieceType,
      resultsInCheck: move.resultsInCheck,
      resultsInCheckmate: move.resultsInCheckmate,
      resultsInStalemate: move.resultsInStalemate,
    };

    setLocalMoveHistory(prev => {
      const existingMove = prev.find(m => {
        if (!m.from || !m.to || !Array.isArray(m.from) || !Array.isArray(m.to) ||
          !newAction.from || !newAction.to || !Array.isArray(newAction.from) || !Array.isArray(newAction.to)) {
          return false;
        }

        return m.from[0] === newAction.from[0] &&
          m.from[1] === newAction.from[1] &&
          m.to[0] === newAction.to[0] &&
          m.to[1] === newAction.to[1] &&
          m.playerColor === newAction.playerColor;
      });

      if (existingMove) {
        return prev;
      }

      const newHistory = [...prev, newAction];
      localStorage.setItem(`moveHistory_${gameState.gameSessionId}`, JSON.stringify(newHistory));
      return newHistory;
    });

    setTimeout(async () => {
      await loadMoveHistoryFromServer();
    }, 1000);
  };


  const toggleAllowPeopleToWatchTheGame = async () => {
    if (!gameId) return;
    try {
      if (allowSpectators) {
        await gameSessionService.disableSpectators(gameId);
        setAllowSpectators(false);
      } else {
        await gameSessionService.enableSpectators(gameId);
        setAllowSpectators(true);
      }
    } catch (e) {
      console.error(e);
    }
  };


  const checkForGameEnd = async () => {
    if (!gameState.gameSessionId || isReviewMode) return;

    try {
      // Check for checkmate
      const isWhiteCheckmate = await chessGameService.isCheckmate(gameState.gameSessionId, "white");
      const isBlackCheckmate = await chessGameService.isCheckmate(gameState.gameSessionId, "black");

      // Check for draw
      const isWhiteDraw = await chessGameService.isDraw(gameState.gameSessionId, "white");
      const isBlackDraw = await chessGameService.isDraw(gameState.gameSessionId, "black");

      if (isWhiteCheckmate) {
        const checkmateResult: GameResult = {
          winner: "black",
          winnerName: playerStats.black.name,
          pointsAwarded: 0, // Will be calculated based on streak
          gameEndReason: "checkmate",
          gameid: gameState.gameSessionId,
          winnerid: gameState.userId2 || playerStats.black.playerId,
        };
        console.log("[DEBUG] White checkmate detected, calling handleGameEnd");
        handleGameEnd(checkmateResult, localMoveHistory.length);
      } else if (isBlackCheckmate) {
        const checkmateResult: GameResult = {
          winner: "white",
          winnerName: playerStats.white.name,
          pointsAwarded: 0, // Will be calculated based on streak
          gameEndReason: "checkmate",
          gameid: gameState.gameSessionId,
          winnerid: gameState.userId1 || playerStats.white.playerId,
        };
        console.log("[DEBUG] Black checkmate detected, calling handleGameEnd");
        handleGameEnd(checkmateResult, localMoveHistory.length);
      } else if (isWhiteDraw || isBlackDraw) {
        const drawResult: GameResult = {
          winner: "draw" as any,
          winnerName: "Draw",
          pointsAwarded: 0, // Draws typically don't award points
          gameEndReason: "draw",
          gameid: gameState.gameSessionId,
          winnerid: "",
        };
        console.log("[DEBUG] Draw detected, calling handleGameEnd");
        handleGameEnd(drawResult, localMoveHistory.length);
      }
    } catch (error) {
      console.error("Error checking game end conditions:", error);
    }
  };

  useEffect(() => {
    if (!isLoading && gameState.gameSessionId && !isReviewMode) {
      checkForGameEnd();
    }
  }, [localMoveHistory.length, gameState.currentTurn, isReviewMode]);



  // Handle board flip functionality
  const handleFlipBoard = () => {
    setFlipped(!flipped);
  };

  if (isLoading || !timers) {
    return <div className="text-center p-4">Loading game...</div>;
  }
  return (
    <>
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #888;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #555;
        }
      `}</style>
      <div className={`${className}`}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-3">
            <div className="flex flex-col-reverse md:flex-col gap-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <PlayerInfo
                  name={playerStats.black.name}
                  points={playerStats.black.points}
                  color="black"
                  isCurrentPlayer={currentPlayer === "black" && !isReviewMode}
                  userId={playerStats.black.playerId}
                  gameId={gameId}
                />
                <ChessTimer
                  timers={timers}
                  setTimers={setTimers}
                  currentPlayer={currentPlayer}
                  isGameOver={isGameOver || isReviewMode}
                  onTimeout={(color) => {
                    if (isReviewMode) return;

                    setTimers((prev) => prev && ({
                      ...prev,
                      white: { ...prev.white, active: false },
                      black: { ...prev.black, active: false },
                    }));

                    setIsGameOver(true);

                    const winner = color === "white" ? "black" : "white";
                    const winnerName = winner === "white" ? playerStats.white.name : playerStats.black.name;
                    const winnerId = winner === "white" ? gameState.userId1 : gameState.userId2;

                    const timeoutResult: GameResult = {
                      winner,
                      winnerName,
                      pointsAwarded: isRankedMatch ? 0 : 0, // Let backend handle points
                      gameEndReason: "timeout",
                      gameid: gameState.gameSessionId,
                      winnerid: winnerId,
                    };

                    handleGameEnd(timeoutResult, localMoveHistory.length);

                    toast({
                      title: "Game Over - Timeout!",
                      description: `${color === "white" ? playerStats.white.name : playerStats.black.name} ran out of time. ${winnerName} wins!`,
                      duration: 5000,
                    });
                  }}
                  gameId={gameId}
                  playerId={playerId}
                />
                <PlayerInfo
                  name={playerStats.white.name}
                  points={playerStats.white.points}
                  color="white"
                  isCurrentPlayer={currentPlayer === "white" && !isReviewMode}
                  userId={playerStats.white.playerId}
                  gameId={gameId}
                />
              </div>

              <ChessBoardPvP
                flipped={flipped}
                currentPlayer={currentPlayer}
                onMove={handlePlayerChange}
                gameState={gameState}
                onGameStateChange={setGameState}
                playerColor={playerColor}
                timers={timers}
                onTimeUpdate={setTimers}
                player1Name={playerStats.white.name}
                player2Name={playerStats.black.name}
                onResetGame={resetGame}
                onMoveMade={handleMoveMade} onGameEnd={function (result: GameResult): Promise<void> {
                throw new Error("Function not implemented.");
              }} onTimeout={function (color: PieceColor): void {
                throw new Error("Function not implemented.");
              }}              />

              <GameControls
                playerColor={playerColor}
                onResign={(customResult?: GameResult, moveCount?: number) => {
                  if (isReviewMode) return;

                  if (customResult) {
                    // If moveCount is provided (from draw acceptance), use it; otherwise use localMoveHistory
                    const effectiveMoveCount = moveCount !== undefined ? moveCount : localMoveHistory.length;
                    handleGameEnd(customResult, effectiveMoveCount);
                  } else {
                    const winner = currentPlayer === "white" ? "black" : "white";
                    const resignationResult: GameResult = {
                      winner,
                      winnerName: winner === "white" ? playerStats.white.name : playerStats.black.name,
                      pointsAwarded: isRankedMatch ? 0 : 0, // Let backend handle points
                      gameEndReason: "resignation",
                      gameid: gameState.gameSessionId,
                      winnerid: winner === "white" ? gameState.userId1 : gameState.userId2,
                    };

                    handleGameEnd(resignationResult, localMoveHistory.length);
                  }
                }}
                onReset={resetGame}
                onFlipBoard={handleFlipBoard}
                gameState={gameState}
                currentPlayer={currentPlayer}
                isGameOver={isGameOver}
                gameResult={gameResult}
                isReviewMode={isReviewMode}
                isRankedMatch={isRankedMatch}
              />
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="bg-muted p-4 rounded-lg h-full">
              <h3 className="font-bold text-xl mb-4">Game Info</h3>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-1">Game Type</h4>
                  <p className="text-sm bg-primary/10 text-primary font-medium px-2 py-1 rounded inline-block">
                    {isRankedMatch ? "Ranked Match" : "Normal Match"}
                  </p>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Current Turn</h4>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded-full ${currentPlayer === "white" ? "bg-white border border-black/20" : "bg-black"}`}></div>
                    <span className="capitalize">{currentPlayer}</span>
                  </div>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Game Status</h4>
                  <div>
                    {isGameOver ? (
                      <p className="text-red-600 font-medium">Game Over</p>
                    ) : gameState.isCheck ? (
                      <p className="text-amber-600 font-medium">Check!</p>
                    ) : gameState.isCheckmate ? (
                      <p className="text-red-600 font-medium">Checkmate!</p>
                    ) : (
                      <p className="text-green-600 font-medium">In Progress</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={toggleAllowPeopleToWatchTheGame}
                    className={`px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2 ${
                      allowSpectators ? "bg-green-500 text-white" : "bg-gray-300 text-black"
                    }`}
                  >
                    {allowSpectators ? "ON" : "OFF"}
                  </button>
                  <h4 className="font-medium mb-1">Viewers Allowed</h4>
                </div>

                <div>
                  <h4 className="font-medium mb-1">Points at Stake</h4>
                  <p className="text-lg font-bold text-primary">
                    {isRankedMatch ? "Streak-Based" : "0"}
                  </p>
                  {!isRankedMatch ? (
                    <p className="text-xs text-muted-foreground">
                      Casual match - no points awarded
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Win: 15 + streak bonus | Draw: 5 (after 20+ moves) | Loss: -8 + streak penalty
                    </p>
                  )}
                </div>
                <div>
                  <h4 className="font-medium mb-1">Move History</h4>
                  <div className="max-h-48 overflow-y-auto custom-scrollbar">
                    {localMoveHistory.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No moves yet</p>
                    ) : (
                      <ul className="text-sm space-y-1">
                        {localMoveHistory.reduce((acc: JSX.Element[], action, index) => {
                          if (index % 2 === 0) {
                            const whiteMove = action;
                            const blackMove = localMoveHistory[index + 1];

                            acc.push(
                              <li key={whiteMove.sequenceNumber || index}>
                                {Math.floor(index / 2) + 1}. White: {moveToAlgebraicNotation(whiteMove)}{' '}
                                {blackMove ? `Black: ${moveToAlgebraicNotation(blackMove)}` : ''}
                              </li>
                            );
                          }
                          return acc;
                        }, [])}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <GameEndModal
          open={isModalOpen}
          gameResult={gameResult}
          onClose={() => setIsModalOpen(false)}
          onPlayAgain={() => navigate("/lobby")}
          onReviewGame={() => setIsModalOpen(false)}
          onBackToMenu={() => navigate("/")}
          isRankedMatch={isRankedMatch}
          totalPoints={totalPoints}
          forcedPointsDelta={forcedPointsDelta ?? undefined}
        />
      </div>
    </>
  );
};


export default ChessGameLayoutPvP;
