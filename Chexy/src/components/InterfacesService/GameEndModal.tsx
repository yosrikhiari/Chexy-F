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
import { gameHistoryService } from "@/services/GameHistoryService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { pointsAttributionService } from "@/services/PointsCalculationService.ts";

// Update the props interface to include onReviewGame and onBackToMenu
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
                                                           }) => {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pointsCalculation, setPointsCalculation] = useState<{
    winnerPoints: number;
    loserPoints: number;
    winnerStreak: number;
    loserStreak: number;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFromMatchmaking, setIsFromMatchmaking] = useState(false);
  // Extract properties safely with default values
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

// Calculate dynamic points and update user points and game history on the backend
  useEffect(() => {
    if (!gameResult || isProcessing) return;

    const updateBackend = async () => {
      setIsProcessing(true);

      try {
        if (!authService.isLoggedIn()) {
          setError("User not logged in. Points and history not updated.");
          return;
        }

        const keycloakId = JwtService.getKeycloakId();
        if (!keycloakId) {
          setError("Unable to identify user. Points and history not updated.");
          return;
        }

        console.log("[DEBUG] Processing game end for:", { gameid, winner, winnerid, isRankedMatch });

        // Get game session to find both player IDs
        const gameSession = await gameSessionService.getGameSession(gameid);
        const whitePlayerId = gameSession.whitePlayer.userId;
        const blackPlayerId = gameSession.blackPlayer.userId;

        // Calculate and update points if it's a ranked match
        if (isRankedMatch && whitePlayerId && blackPlayerId) {
          try {
            const isDraw = winner === "draw" || gameEndReason === "draw";
            let actualWinnerId: string;
            let actualLoserId: string;

            if (isDraw) {
              actualWinnerId = whitePlayerId;
              actualLoserId = blackPlayerId;
            } else {
              actualWinnerId = winner === "white" ? whitePlayerId : blackPlayerId;
              actualLoserId = actualWinnerId === whitePlayerId ? blackPlayerId : whitePlayerId;
            }

            // Use the points service to calculate AND update points
            const pointsCalc = await pointsAttributionService.calculateAndUpdatePoints(
              actualWinnerId,
              actualLoserId,
              isDraw
            );

            console.log("[DEBUG] Points calculation result:", pointsCalc);
            setPointsCalculation(pointsCalc);

            // Update the game result with calculated points
            const updatedGameResult = {
              ...gameResult,
              pointsAwarded: isDraw ? 0 : pointsCalc.winnerPoints
            };

            // Complete game history
            try {
              const history = await gameHistoryService.getGameHistoriesBySession(gameid);
              if (history && history.id) {
                await gameHistoryService.completeGameHistory(history.id, updatedGameResult);
              }
            } catch (historyError) {
              console.error("Failed to complete game history:", historyError);
            }

          } catch (pointsError) {
            console.error("Failed to calculate/update points:", pointsError);
            setError("Failed to update points. Please contact support.");
          }
        }

        // Always refresh user data
        try {
          const updatedUser = await userService.getCurrentUser(keycloakId);
          localStorage.setItem("user", JSON.stringify(updatedUser));
          console.log("[DEBUG] User data refreshed, new points:", updatedUser.points);
        } catch (userUpdateError) {
          console.error("Failed to refresh user data:", userUpdateError);
        }

      } catch (err) {
        console.error("Error updating backend:", err);
        setError("Failed to update game data. Please try again.");
      } finally {
        setIsProcessing(false);
      }
    };

    updateBackend();
  }, [gameResult, gameid, isRankedMatch, winner, gameEndReason]);

  const handlePlayAgain = async () => {
    try {
      // Refresh user data before navigating to ensure latest points are shown
      const keycloakId = JwtService.getKeycloakId();
      if (keycloakId) {
        try {
          const updatedUser = await userService.getCurrentUser(keycloakId);
          localStorage.setItem("user", JSON.stringify(updatedUser));
          console.log("[DEBUG] User data refreshed before navigation:", updatedUser.points);
        } catch (error) {
          console.error("Failed to refresh user data before navigation:", error);
        }
      }

      navigate("/lobby", { replace: true });
      onClose();
    } catch (error) {
      console.error("Error navigating to lobby:", error);
      navigate("/lobby", { replace: true });
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
    if (winner === "draw") return 0;
    return pointsCalculation ? pointsCalculation.winnerPoints : pointsAwarded;
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
              : `${winnerName} wins ${reasonText[gameEndReason] || reasonText.checkmate}!`
            }
          </h2>

          {gameEndReason === "timeout" && (
            <p className="text-sm text-muted-foreground text-center mt-2">
              The opponent ran out of time.
            </p>
          )}

          {/* Processing indicator */}
          {isProcessing && (
            <p className="text-sm text-blue-600 text-center">
              Processing points...
            </p>
          )}

          {/* Points Display */}
          <div className="bg-muted p-4 rounded-md w-full text-center">
            <p className="text-sm text-muted-foreground mb-1">
              {isRankedMatch ? "Ranked Points Awarded" : "Casual Match - No Points Awarded"}
            </p>
            <p className="text-2xl font-bold text-primary">
              {displayPoints()}
            </p>

            {/* Show streak information if available */}
            {isRankedMatch && pointsCalculation && !isProcessing && (
              <div className="mt-2 text-xs text-muted-foreground">
                {winner !== "draw" ? (
                  <>
                    <p>Winner streak: {pointsCalculation.winnerStreak} wins</p>
                    <p>Loser penalty: -{Math.abs(pointsCalculation.loserPoints)} points</p>
                  </>
                ) : (
                  <p>Draw - minimal points exchanged</p>
                )}
              </div>
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
