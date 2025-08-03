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
import {PointCalculationService} from "@/services/PointsCalculatorService.tsx";

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
  const [calculatedPoints, setCalculatedPoints] = useState<number>(0);
  const [streakInfo, setStreakInfo] = useState<string>("");

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

  useEffect(() => {
    if (!gameResult || isProcessing) return;

    const updateBackend = async () => {
      setIsProcessing(true);
      try {
        if (!authService.isLoggedIn()) {
          setError("User not logged in. History not updated.");
          return;
        }

        const keycloakId = JwtService.getKeycloakId();
        if (!keycloakId) {
          setError("Unable to identify user. History not updated.");
          return;
        }

        // Get current user
        const currentUser = await userService.getCurrentUser(keycloakId);
        const currentUserId = currentUser.id;

        // Calculate points for the current user BEFORE updating backend
        if (isRankedMatch && winnerid) {
          const isCurrentUserWinner = winnerid === currentUserId;
          const isDraw = winner === "draw";

          const calculatedPointsForUser = await PointCalculationService.calculatePoints(
            currentUserId,
            isCurrentUserWinner,
            isDraw,
            isRankedMatch
          );

          setCalculatedPoints(calculatedPointsForUser);

          // If current user won, update their points
          if (isCurrentUserWinner && calculatedPointsForUser > 0) {
            await userService.updateUserPoints(currentUserId, calculatedPointsForUser);
          }
        }

        const gameSession = await gameSessionService.getGameSession(gameid);
        const actualWhitePlayerId = gameSession.whitePlayer?.userId ||
          (Array.isArray(gameSession.whitePlayer) ? gameSession.whitePlayer[0]?.userId : null);
        const actualBlackPlayerId = gameSession.blackPlayer?.[0]?.userId ||
          (Array.isArray(gameSession.blackPlayer) ? gameSession.blackPlayer[0]?.userId : null);

        let actualWinnerId = winnerid;
        if (!actualWinnerId && winner !== "draw") {
          actualWinnerId = winner === "white" ? actualWhitePlayerId : actualBlackPlayerId;
        }

        if (!actualWhitePlayerId || (!actualBlackPlayerId && winner !== "draw")) {
          setError("Unable to identify players. History updated without points.");
        }

        const history = await gameHistoryService.getGameHistoriesBySession(gameid);
        if (history && history.id) {
          // Create the result with calculated points for the winner
          let finalPointsAwarded = 0;
          if (isRankedMatch && actualWinnerId) {
            // Calculate points for the actual winner
            const isDraw = winner === "draw";
            finalPointsAwarded = await PointCalculationService.calculatePoints(
              actualWinnerId,
              true, // They are the winner
              isDraw,
              isRankedMatch
            );

            // Update the winner's points
            if (finalPointsAwarded > 0) {
              await userService.updateUserPoints(actualWinnerId, finalPointsAwarded);
            }
          }

          const updatedGameResult = {
            ...gameResult,
            winnerid: actualWinnerId || "",
            pointsAwarded: finalPointsAwarded
          };

          await gameHistoryService.completeGameHistory(history.id, updatedGameResult);
        }

        // Refresh user data to get updated points
        const updatedUser = await userService.getCurrentUser(keycloakId);
        localStorage.setItem("user", JSON.stringify(updatedUser));

      } catch (err) {
        console.error("Error updating backend:", err);
        setError("Failed to update game data.");
      } finally {
        setIsProcessing(false);
      }
    };

    updateBackend();
  }, [gameResult, gameid, isRankedMatch, winner, gameEndReason, winnerid]);

  // Load streak information for display
  useEffect(() => {
    const loadStreakInfo = async () => {
      if (!isRankedMatch || !authService.isLoggedIn()) return;

      try {
        const keycloakId = JwtService.getKeycloakId();
        if (!keycloakId) return;

        const currentUser = await userService.getCurrentUser(keycloakId);
        const gameHistories = await gameHistoryService.getRankedGamesByUser(currentUser.id);

        // Calculate streak (this is a simplified version - you might want to use the full service method)
        const sortedHistories = gameHistories
          .filter(h => h.endTime)
          .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime());

        let streak = 0;
        let lastWasWin: boolean | null = null;

        for (const history of sortedHistories) {
          if (!history.result || history.result.winner === "draw") continue;

          const isWin = history.result.winnerid === currentUser.id;

          if (lastWasWin === null) {
            lastWasWin = isWin;
            streak = isWin ? 1 : -1;
          } else if (lastWasWin === isWin) {
            streak = isWin ? streak + 1 : streak - 1;
          } else {
            break;
          }
        }

        setStreakInfo(PointCalculationService.getStreakDescription(streak));
      } catch (error) {
        console.error("Failed to load streak info:", error);
      }
    };

    loadStreakInfo();
  }, [isRankedMatch]);

  const handlePlayAgain = async () => {
    try {
      const keycloakId = JwtService.getKeycloakId();
      if (keycloakId) {
        const updatedUser = await userService.getCurrentUser(keycloakId);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      }
      navigate("/lobby", { replace: true });
      onClose();
    } catch (error) {
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
    if (!isRankedMatch || winner === "draw") return 0;

    // Show calculated points if available, otherwise fall back to gameResult points
    return calculatedPoints > 0 ? calculatedPoints : pointsAwarded;
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

          {isProcessing && (
            <p className="text-sm text-blue-600 text-center">
              Calculating points and finalizing game...
            </p>
          )}

          <div className="bg-muted p-4 rounded-md w-full text-center">
            <p className="text-sm text-muted-foreground mb-1">
              {isRankedMatch ? "Ranked Points Awarded" : "Casual Match - No Points Awarded"}
            </p>
            <p className="text-2xl font-bold text-primary">
              +{displayPoints()}
            </p>
            {streakInfo && isRankedMatch && (
              <p className="text-xs text-muted-foreground mt-1">
                {streakInfo}
              </p>
            )}
            {isRankedMatch && (
              <p className="text-xs text-muted-foreground mt-1">
                Points range: 12-25 based on streak
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
