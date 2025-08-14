import React, {useState, useEffect} from "react";
import {useNavigate} from "react-router-dom";
import {Button} from "@/components/ui/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog.tsx";
import {GameControlsProps} from "@/Interfaces/GameControlsProps.ts";
import {toast} from "@/components/ui/use-toast.tsx";
import {GameSession} from "@/Interfaces/types/GameSession.ts";
import { normalizePlayer } from "@/utils/sessionUtils.ts";
import {GameResult} from "@/Interfaces/types/chess.ts";
import {gameSessionService} from "@/services/GameSessionService.ts";
import {JwtService} from "@/services/JwtService.ts";
import {userService} from "@/services/UserService.ts";
import { useWebSocket } from "@/WebSocket/WebSocketContext.tsx";

// Updated interface to include additional game state props
interface ExtendedGameControlsProps extends GameControlsProps {
  onBackToLobby?: () => void,
  isGameOver?: boolean,
  gameResult?: GameResult | null,
  isReviewMode?: boolean,
  isRankedMatch?: boolean,
  playerColor?: "white" | "black" | "null",
  onResign?: (customResult?: GameResult, moveCount?: number) => void
}

const GameControls: React.FC<ExtendedGameControlsProps> = ({
                                                             onFlipBoard,
                                                             onChangePlayerNames,
                                                             onResign,
                                                             gameState,
                                                             currentPlayer,
                                                             onBackToLobby,
                                                             isGameOver: propIsGameOver,
                                                             gameResult,
                                                             isReviewMode = false,
                                                             isRankedMatch = false,
                                                             playerColor,
                                                           }) => {
  const navigate = useNavigate();
  const [player1Name, setPlayer1Name] = useState("Player 1");
  const [player2Name, setPlayer2Name] = useState("Player 2");
  const [open, setOpen] = useState(false);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [drawOfferSent] = useState(false);
  const [isResigning, setIsResigning] = useState(false);
  const { client, isConnected } = useWebSocket();
  const [pendingDrawOfferFrom, setPendingDrawOfferFrom] = useState<{ userId: string, username: string } | null>(null);

  // Comprehensive game over check
  const isGameOver = propIsGameOver ||
    gameState?.isCheckmate ||
    gameState?.isDraw ||
    gameResult !== null ||
    (gameResult && [
      "checkmate",
      "timeout",
      "resignation",
      "draw",
      "tie_resolved"
    ].includes(gameResult.gameEndReason));

  // Fetch game session and initial player names
  useEffect(() => {
    const fetchGameSession = async () => {
      if (!gameState?.gameSessionId) return;

      try {
        const session = await gameSessionService.getGameSession(
          gameState.gameSessionId
        );
        setGameSession(session);

        // Handle nested player data structure properly
        const whitePlayer = normalizePlayer(session.whitePlayer as any);
        const blackPlayer = normalizePlayer(session.blackPlayer as any);

        setPlayer1Name(whitePlayer?.username || "Player 1");
        setPlayer2Name(blackPlayer?.username || "Player 2");
      } catch (error) {
        console.error("[FETCH_SESSION] Failed to load game session:", error);
        toast({
          title: "Error",
          description: "Failed to load game session.",
          variant: "destructive",
        });
      }
    };

    fetchGameSession();
  }, [gameState?.gameSessionId]);

  const handleSaveNames = async () => {
    if (!gameSession) {
      toast({
        title: "Error",
        description: "Game session not loaded.",
        variant: "destructive",
      });
      return;
    }

    try {
      const keycloakId = JwtService.getKeycloakId();
      if (!keycloakId) throw new Error("User not authenticated");

      // Handle nested player data structure
      const whitePlayer = normalizePlayer(gameSession.whitePlayer as any);
      const blackPlayer = normalizePlayer(gameSession.blackPlayer as any);

      // Update player usernames in backend
      if (player1Name && whitePlayer && player1Name !== whitePlayer.username) {
        await userService.updateUser(whitePlayer.userId, {
          username: player1Name,
        });
      }

      if (player2Name && blackPlayer && player2Name !== blackPlayer.username) {
        await userService.updateUser(blackPlayer.userId, {
          username: player2Name,
        });
      }

      // Update local state via prop
      if (onChangePlayerNames) {
        onChangePlayerNames({
          player1: player1Name || "Player 1",
          player2: player2Name || "Player 2",
        });
      }

      toast({
        title: "Success",
        description: "Player names updated.",
      });
      setOpen(false);
    } catch (error) {
      console.error("[SAVE_NAMES] Failed to update player names:", error);
      toast({
        title: "Error",
        description: "Failed to update player names.",
        variant: "destructive",
      });
    }
  };

  const handleNewGame = () => {
    navigate("/lobby");
  };

  const handleResign = async () => {
    if (!gameState?.gameSessionId || !gameSession || isResigning) {
      console.error("[RESIGN] Cannot resign - missing game data or already in progress");
      toast({
        title: "Error",
        description: "Cannot resign at this time",
        variant: "destructive",
      });
      return;
    }

    // Prevent multiple resignation attempts
    setIsResigning(true);

    try {
      console.log("[RESIGN] Starting resignation process...");

      // Get current user information
      const keycloakId = JwtService.getKeycloakId();
      if (!keycloakId) throw new Error("User not authenticated");

      const currentUser = await userService.getCurrentUser(keycloakId);
      const resigningUserId = currentUser.id;

      // CRITICAL FIX: Handle nested player data structure properly
      const normalizePlayerData = (playerData: any) => {
        if (!playerData) return null;
        if (Array.isArray(playerData)) {
          return playerData.length > 0 ? playerData[0] : null;
        }
        if (typeof playerData === 'object') {
          return playerData;
        }
        return null;
      };

      const whitePlayer = normalizePlayerData(gameSession.whitePlayer);
      const blackPlayer = normalizePlayerData(gameSession.blackPlayer);

      console.log("[RESIGN] Resignation context:", {
        resigningUserId,
        gameSessionId: gameState.gameSessionId,
        whitePlayer: whitePlayer ? { userId: whitePlayer.userId, username: whitePlayer.username } : null,
        blackPlayer: blackPlayer ? { userId: blackPlayer.userId, username: blackPlayer.username } : null,
        gameState: {
          userId1: gameState.userId1,
          userId2: gameState.userId2
        }
      });

      // CRITICAL FIX: Use properly normalized player data
      const whitePlayerId = whitePlayer?.userId;
      const blackPlayerId = blackPlayer?.userId;

      // Validate that the resigning user is actually in this game
      if (resigningUserId !== whitePlayerId && resigningUserId !== blackPlayerId) {
        console.error("[RESIGN] User not found in this game session");
        console.error("[RESIGN] Expected one of:", { whitePlayerId, blackPlayerId });
        console.error("[RESIGN] Got:", resigningUserId);
        throw new Error("You are not a participant in this game");
      }

      // Determine winner based on who is resigning
      let winnerId: string;
      let winnerName: string;
      let winnerColor: "white" | "black";

      if (resigningUserId === whitePlayerId) {
        // White player resigned, black wins
        if (!blackPlayerId) {
          throw new Error("Black player not found - cannot determine winner");
        }
        winnerId = blackPlayerId;
        winnerColor = "black";
        winnerName = player2Name || blackPlayer?.username || "Black Player";
        console.log("[RESIGN] White player resigned, black wins");
      } else if (resigningUserId === blackPlayerId) {
        // Black player resigned, white wins
        if (!whitePlayerId) {
          throw new Error("White player not found - cannot determine winner");
        }
        winnerId = whitePlayerId;
        winnerColor = "white";
        winnerName = player1Name || whitePlayer?.username || "White Player";
        console.log("[RESIGN] Black player resigned, white wins");
      } else {
        // This shouldn't happen due to validation above, but just in case
        throw new Error("Could not determine which player is resigning");
      }

      // Final validation - make sure we have a valid winner
      if (!winnerId || winnerId === resigningUserId || winnerId === "") {
        console.error("[RESIGN] Invalid winner determination");
        console.error("[RESIGN] Winner ID:", winnerId, "Resigning User ID:", resigningUserId);
        throw new Error("Could not determine game winner - invalid winner ID");
      }

      // Create the game result
      const resignationResult: GameResult = {
        winner: winnerColor,
        winnerName: winnerName,
        pointsAwarded: 0, // Will be calculated by parent component based on streak
        gameEndReason: "resignation",
        gameid: gameState.gameSessionId,
        winnerid: winnerId,
      };

      console.log("[RESIGN] Created resignation result:", resignationResult);

      // Call parent's onResign immediately to handle local game state
      if (onResign) {
        console.log("[RESIGN] Calling parent onResign handler...");
        onResign(resignationResult);
      }

      // Show success message
      toast({
        title: "Game Resigned",
        description: `You have resigned. ${winnerName} wins!`,
      });

      // Backend cleanup (fire and forget - don't wait for it)
      setTimeout(async () => {
        try {
          console.log("[RESIGN] Updating backend game status (endGame only)...");
          // Calling endGame is sufficient; it sets status to COMPLETED server-side.
          await gameSessionService.endGame(gameState.gameSessionId, winnerId);
          console.log("[RESIGN] Backend cleanup completed");
        } catch (backendError) {
          console.error("[RESIGN] Backend cleanup failed (non-critical):", backendError);
        }
      }, 100);

    } catch (error) {
      console.error("[RESIGN] Resignation failed:", error);
      toast({
        title: "Resignation Failed",
        description: error.message || "Failed to process resignation",
        variant: "destructive",
      });
    } finally {
      // Always reset the resigning state
      setTimeout(() => setIsResigning(false), 1000);
    }
  };

  const handleDrawOffer = async () => {
    if (!gameSession || !currentPlayer) return;

    try {
      const keycloakId = JwtService.getKeycloakId();
      if (!keycloakId) throw new Error("User not authenticated");

      const me = await userService.getCurrentUser(keycloakId);
      const white = normalizePlayer(gameSession.whitePlayer as any);
      const black = normalizePlayer(gameSession.blackPlayer as any);
      const opponentId = me.id === white?.userId ? black?.userId : white?.userId;

      if (!client || !isConnected || !opponentId) {
        throw new Error("Not connected or opponent missing");
      }

      client.publish({
        destination: "/app/game/draw/offer",
        body: JSON.stringify({
          gameId: gameState.gameSessionId,
          fromUserId: me.id,
          fromUsername: me.username,
          toUserId: opponentId
        })
      });

      toast({
        title: "Draw Offer Sent",
        description: "Waiting for opponent to respond...",
      });
    } catch (error) {
      console.error("[DRAW] Failed to send draw offer:", error);
      toast({
        title: "Error",
        description: "Failed to send draw offer.",
        variant: "destructive",
      });
    }
  };

  // Subscribe to draw offer/response messages
  useEffect(() => {
    if (!client || !isConnected || !gameState?.gameSessionId) return;

    const subs: any[] = [];

    try {
      const attach = async () => {
        const keycloakId = JwtService.getKeycloakId();
        if (!keycloakId) return;
        const me = await userService.getCurrentUser(keycloakId);

        // Offer received (per-user destination)
        const offerSub = client.subscribe(`/queue/game/draw/offer/${me.id}`, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            if (data.gameId !== gameState.gameSessionId) return;
            setPendingDrawOfferFrom({ userId: data.fromUserId, username: data.fromUsername });
            toast({
              title: "Draw Offer",
              description: `The player ${data.fromUsername} has proposed a draw. Accept?`,
            });
          } catch (e) {
            console.error("[DRAW] Failed to parse offer:", e);
          }
        });
        subs.push(offerSub);

        // Accepted (per-user destination)
        const acceptedSub = client.subscribe(`/queue/game/draw/accepted/${me.id}`, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            if (data.gameId !== gameState.gameSessionId) return;
            
            // Get the current move count from the parent component
            const moveCount = window.localStorage.getItem(`moveHistory_${gameState.gameSessionId}`);
            const moveHistory = moveCount ? JSON.parse(moveCount) : [];
            const actualMoveCount = moveHistory.length;
            
            // End locally as draw with proper move count for points calculation
            const drawResult: GameResult = {
              winner: "draw" as any,
              winnerName: "Draw",
              pointsAwarded: 0, // Will be calculated by parent based on move count
              gameEndReason: "draw",
              gameid: gameState.gameSessionId,
              winnerid: "",
            };
            
            // Call onResign with the draw result - parent will handle points calculation
            onResign?.(drawResult, actualMoveCount);
            setPendingDrawOfferFrom(null);
            toast({ title: "Draw Accepted", description: "The game has ended in a draw." });
          } catch (e) {
            console.error("[DRAW] Failed to parse accepted:", e);
          }
        });
        subs.push(acceptedSub);

        // Declined (per-user destination)
        const declinedSub = client.subscribe(`/queue/game/draw/declined/${me.id}`, (msg) => {
          try {
            const data = JSON.parse(msg.body);
            if (data.gameId !== gameState.gameSessionId) return;
            setPendingDrawOfferFrom(null);
            toast({ title: "Draw Declined", description: "Opponent declined the draw offer." });
          } catch (e) {
            console.error("[DRAW] Failed to parse declined:", e);
          }
        });
        subs.push(declinedSub);
      };

      attach();
    } catch (e) {
      console.error("[DRAW] Subscription setup failed:", e);
    }

    return () => {
      subs.forEach((s) => {
        try { s.unsubscribe?.(); } catch {}
      });
    };
  }, [client, isConnected, gameState?.gameSessionId]);

  const respondToDraw = async (accepted: boolean) => {
    if (!client || !isConnected || !pendingDrawOfferFrom || !gameState?.gameSessionId) return;
    try {
      const keycloakId = JwtService.getKeycloakId();
      if (!keycloakId) throw new Error("User not authenticated");
      const me = await userService.getCurrentUser(keycloakId);

      client.publish({
        destination: "/app/game/draw/response",
        body: JSON.stringify({
          gameId: gameState.gameSessionId,
          fromUserId: me.id,
          toUserId: pendingDrawOfferFrom.userId,
          accepted,
        })
      });

      if (!accepted) {
        toast({ title: "Draw Declined", description: "You declined the draw offer." });
        setPendingDrawOfferFrom(null);
      }
    } catch (e) {
      console.error("[DRAW] Failed to send response:", e);
      toast({ title: "Error", description: "Failed to respond to draw offer", variant: "destructive" });
    }
  };

  // If game is over or in review mode, only show New Game button
  if (isGameOver || isReviewMode) {
    return (
      <div className="flex flex-wrap gap-3 justify-center mt-4">
        <Button
          onClick={handleNewGame}
          variant="outline"
          className="border-primary/50 hover:bg-primary/10"
        >
          New Game
        </Button>

        {/* Optional: Keep flip board functionality in review mode */}
        {onFlipBoard && (
          <Button
            onClick={onFlipBoard}
            variant="outline"
            className="border-primary/50 hover:bg-primary/10"
          >
            Flip Board
          </Button>
        )}
      </div>
    );
  }

  // Active game controls (when game is still in progress)
  return (
    <div className="flex flex-wrap gap-3 justify-center mt-4">
      {onFlipBoard && (
        <Button
          onClick={onFlipBoard}
          variant="outline"
          className="border-primary/50 hover:bg-primary/10"
        >
          Flip Board
        </Button>
      )}

      {onChangePlayerNames && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="border-primary/50 hover:bg-primary/10"
            >
              Edit Players
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Player Names</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-right col-span-1">White:</span>
                <Input
                  id="player1"
                  value={player1Name}
                  onChange={(e) => setPlayer1Name(e.target.value)}
                  className="col-span-3"
                />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <span className="text-right col-span-1">Black:</span>
                <Input
                  id="player2"
                  value={player2Name}
                  onChange={(e) => setPlayer2Name(e.target.value)}
                  className="col-span-3"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={handleSaveNames}>
                Save
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Draw offer button - only shown when game is active */}
      {onResign && (
        <Button
          onClick={handleDrawOffer}
          variant="outline"
          className="border-blue-500/50 hover:bg-blue-500/10 text-blue-600"
        >
          Offer Draw
        </Button>
      )}

      {/* Resign button - only shown when game is active */}
      {onResign && (
        <Button
          onClick={handleResign}
          variant="destructive"
          className="hover:bg-destructive/90"
          disabled={isResigning}
        >
          {isResigning ? "Resigning..." : "Resign"}
        </Button>
      )}

      {pendingDrawOfferFrom && (
        <div className="w-full flex flex-col items-center gap-2 mt-2">
          <div className="text-sm">The player {pendingDrawOfferFrom.username} has proposed a draw. Accept?</div>
          <div className="flex gap-2">
            <Button onClick={() => respondToDraw(true)} className="bg-green-600 hover:bg-green-700 text-white">Yes</Button>
            <Button onClick={() => respondToDraw(false)} variant="outline" className="border-red-500/50 text-red-600">No</Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GameControls;
