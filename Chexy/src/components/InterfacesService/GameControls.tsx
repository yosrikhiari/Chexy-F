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
import {GameResult} from "@/Interfaces/types/chess.ts";
import {gameSessionService} from "@/services/GameSessionService.ts";
import {JwtService} from "@/services/JwtService.ts";
import {userService} from "@/services/UserService.ts";
import {PointCalculationService} from "@/services/PointsCalculatorService.tsx";

// Updated interface to include additional game state props
interface ExtendedGameControlsProps extends GameControlsProps {
  onBackToLobby?: () => void,
  isGameOver?: boolean,
  gameResult?: GameResult | null,
  isReviewMode?: boolean,
  isRankedMatch?: boolean,
  playerColor?: "white" | "black" | "null"
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
                                                             playerColor
                                                           }) => {
  const navigate = useNavigate();
  const [player1Name, setPlayer1Name] = useState("Player 1");
  const [player2Name, setPlayer2Name] = useState("Player 2");
  const [open, setOpen] = useState(false);
  const [gameSession, setGameSession] = useState<GameSession | null>(null);
  const [drawOfferSent] = useState(false);
  const [isResigning, setIsResigning] = useState(false);

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
        setPlayer1Name(session.whitePlayer.username || "Player 1");
        setPlayer2Name(session.blackPlayer.username || "Player 2");
      } catch (error) {
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

      // Update player usernames in backend
      const whitePlayerId = gameSession.whitePlayer.userId;
      const blackPlayerId = gameSession.blackPlayer.userId;

      if (player1Name && player1Name !== gameSession.whitePlayer.username) {
        await userService.updateUser(whitePlayerId, {
          username: player1Name,
        });
      }

      if (player2Name && player2Name !== gameSession.blackPlayer.username) {
        await userService.updateUser(blackPlayerId, {
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
    if (!gameState?.gameSessionId || !gameSession || !currentPlayer || isResigning) {
      toast({
        title: "Error",
        description: "Game session not loaded or already resigning",
        variant: "destructive",
      });
      return;
    }

    setIsResigning(true);

    try {
      console.log("[DEBUG] Starting resignation process...");

      const winnerColor = playerColor === "white" ? "black" : "white";

      // Get actual player IDs from the gameSession object
      let winnerId: string;
      let winnerName: string;

      if (winnerColor === "white") {
        const whitePlayer = Array.isArray(gameSession.whitePlayer)
          ? gameSession.whitePlayer[0]
          : gameSession.whitePlayer;
        winnerId = whitePlayer?.userId || whitePlayer?.id || gameState.userId1;
        winnerName = whitePlayer?.username || player1Name;
      } else {
        const blackPlayer = Array.isArray(gameSession.blackPlayer)
          ? gameSession.blackPlayer[0]
          : gameSession.blackPlayer;
        winnerId = blackPlayer?.userId || blackPlayer?.id || gameState.userId2;
        winnerName = blackPlayer?.username || player2Name;
      }

      // Validate winnerId
      if (!winnerId) {
        console.error("[ERROR] Could not determine winnerId from game session");
        winnerId = winnerColor === "white"
          ? (gameState.userId1 || "unknown")
          : (gameState.userId2 || "unknown");
      }

      // Calculate points for resignation
      let calculatedPoints = 0;
      if (isRankedMatch && winnerId) {
        calculatedPoints = await PointCalculationService.calculatePoints(
          winnerId,
          true, // Winner
          false, // Not a draw
          isRankedMatch
        );
      }

      const gameResult: GameResult = {
        winner: winnerColor,
        winnerName: winnerName,
        pointsAwarded: calculatedPoints,
        gameEndReason: "resignation",
        gameid: gameState.gameSessionId,
        winnerid: winnerId,
      };

      console.log("[DEBUG] Created game result with calculated points:", gameResult);

      // Call parent's onResign IMMEDIATELY
      if (onResign) {
        console.log("[DEBUG] Calling parent onResign...");
        onResign(gameResult);
      }

      // Backend cleanup
      try {
        await gameSessionService.updateGameStatus(gameState.gameSessionId, "COMPLETED");
        await gameSessionService.endGame(gameState.gameSessionId, winnerId);
        console.log("[DEBUG] Backend cleanup completed");
      } catch (backendError) {
        console.error("[ERROR] Backend cleanup failed:", backendError);
      }

      toast({
        title: "Game Resigned",
        description: `${currentPlayer === "white" ? player1Name : player2Name} has resigned.`,
      });

    } catch (error) {
      console.error("[ERROR] Resignation failed:", error);
      toast({
        title: "Error",
        description: "Failed to process resignation",
        variant: "destructive",
      });
    } finally {
      setIsResigning(false);
    }
  };

  const handleDrawOffer = async () => {
    if (!gameSession || !currentPlayer) return;

    try {
      const currentUserId = JwtService.getKeycloakId();
      if (!currentUserId) throw new Error("User not authenticated");

      const drawResult: GameResult = {
        winner: "draw" as any,
        winnerName: "Draw by agreement",
        pointsAwarded: 0, // Draws don't award points
        gameEndReason: "draw",
        gameid: gameState.gameSessionId,
        winnerid: "",
      };

      // Call the parent's onResign function to trigger game end
      if (onResign) {
        onResign(drawResult);
      }

      toast({
        title: "Draw Agreed",
        description: "Both players agreed to a draw.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to process draw offer.",
        variant: "destructive",
      });
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
          disabled={drawOfferSent}
        >
          {drawOfferSent ? "Draw Offered" : "Offer Draw"}
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
    </div>
  );
};

export default GameControls;
