import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Trophy } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog.tsx";
import { GameEndModalProps } from "@/Interfaces/GameEndModalProps.ts";
import { authService } from "@/services/AuthService.ts";
import { JwtService } from "@/services/JwtService.ts";
import { userService } from "@/services/UserService.ts";

interface ExtendedGameEndModalProps extends GameEndModalProps {
  onReviewGame: () => void;
  onBackToMenu: () => void;
}

const GameEndModal: React.FC<ExtendedGameEndModalProps> = ({
                                                             open,
                                                             gameResult,
                                                             onClose,
                                                             onPlayAgain,
                                                             onReviewGame,
                                                             onBackToMenu,
                                                             isRankedMatch = false,
                                                             totalPoints,
                                                           }) => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actualPointsAwarded, setActualPointsAwarded] = useState<number>(0);
  const [initialUserPoints, setInitialUserPoints] = useState<number | null>(null);

  const [pointsCalculationResult, setPointsCalculationResult] = useState<{
    pointsAwarded: number;
    newTotalPoints: number;
    streakModifier: number;
    basePoints: number;
  } | null>(null);

  const {
    winner = "",
    winnerName = "",
    pointsAwarded = 0,
    gameEndReason = "checkmate",
    gameid = "",
    winnerid = "",
  } = gameResult || {};

  const reasonText = {
    checkmate: "by checkmate",
    timeout: "by timeout",
    resignation: "by resignation",
    draw: "in a draw",
  };

  // Get initial points when modal opens
  useEffect(() => {
    const getInitialPoints = async () => {
      if (!authService.isLoggedIn()) return;

      try {
        const keycloakId = JwtService.getKeycloakId();
        if (!keycloakId) return;

        const currentUser = await userService.getCurrentUser(keycloakId);
        setInitialUserPoints(currentUser.points);
      } catch (error) {
        console.error("Failed to get initial user points:", error);
      }
    };

    if (open && !initialUserPoints) {
      getInitialPoints();
    }
  }, [open]);

  // Calculate actual points change by comparing current total with initial
  useEffect(() => {
    if (totalPoints !== null && initialUserPoints !== null) {
      const pointsDifference = totalPoints - initialUserPoints;
      setActualPointsAwarded(pointsDifference);
    }
  }, [totalPoints, initialUserPoints]);

  const handlePlayAgain = async () => {
    try {
      // Force refresh user data before navigating
      const keycloakId = JwtService.getKeycloakId();
      if (keycloakId) {
        console.log("[DEBUG] Refreshing user data before lobby navigation...");
        const updatedUser = await userService.getCurrentUser(keycloakId);
        localStorage.setItem("user", JSON.stringify(updatedUser));
        console.log("[DEBUG] User data refreshed before lobby navigation:", updatedUser.points);
      }

      // Navigate with replace to prevent back button issues
      navigate("/lobby", {
        replace: true,
        state: { forceRefresh: true }
      });
      onClose();
    } catch (error) {
      console.error("Failed to refresh user data:", error);
      // Navigate anyway
      navigate("/lobby", { replace: true, state: { forceRefresh: true } });
      onClose();
    }
  };

  const handleBackToMenu = () => {
    navigate("/lobby");
    onClose();
  };

  if (!gameResult) return null;

  const displayPoints = () => {
    if (!isRankedMatch) return 0;

    // Show actual points difference if available
    if (actualPointsAwarded !== 0) {
      return actualPointsAwarded;
    }

    // Fallback to pointsAwarded from gameResult
    if (gameResult?.pointsAwarded !== undefined) {
      return gameResult.pointsAwarded;
    }

    return 0;
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center text-2xl font-bold">
            Game Over!
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            The match has concluded
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Trophy className="h-8 w-8 text-primary" />
          </div>

          <h2 className="text-xl font-bold text-center">
            {winner === "draw"
              ? "Game ended in a draw!"
              : `${winnerName} wins ${reasonText[gameEndReason] || reasonText.checkmate}!`}
          </h2>

          {gameEndReason === "timeout" && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              The opponent ran out of time.
            </p>
          )}

          <div className="bg-muted p-4 rounded-md w-full text-center">
            <p className="text-sm text-muted-foreground mb-1">
              {isRankedMatch ? "Streak-Based Points Change" : "Casual Match - No Points Awarded"}
            </p>
            <p className={`text-2xl font-bold ${displayPoints() >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {displayPoints() >= 0 ? '+' : ''}{displayPoints()}
            </p>
            {isRankedMatch && (
              <p className="text-xs text-muted-foreground mt-1">
                Points based on winning/losing streak
              </p>
            )}
            {totalPoints !== null && (
              <p className="text-sm text-muted-foreground mt-2">
                New Total Points: {totalPoints}
              </p>
            )}
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 w-full mt-4">
            <button
              className="flex-1 bg-primary text-primary-foreground font-medium py-2 rounded-md hover:bg-primary/90 transition-colors"
              onClick={handlePlayAgain}
              disabled={isProcessing}
            >
              Play Again
            </button>
            <button
              className="flex-1 bg-secondary text-secondary-foreground font-medium py-2 rounded-md hover:bg-secondary/90 transition-colors"
              onClick={onReviewGame}
            >
              Review Game
            </button>
            <button
              className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary font-medium py-2 rounded-md transition-colors"
              onClick={handleBackToMenu}
            >
              Back to Menu
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default GameEndModal;
