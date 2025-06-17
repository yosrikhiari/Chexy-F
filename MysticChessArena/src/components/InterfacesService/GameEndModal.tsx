import React, { useEffect, useState } from "react";
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

const GameEndModal: React.FC<GameEndModalProps> = ({
                                                     open,
                                                     gameResult,
                                                     onClose,
                                                     onPlayAgain,
                                                     isRankedMatch = false,
                                                   }) => {
  const [error, setError] = useState<string | null>(null);

  // Extract properties safely with default values
  const {
    winner = "",
    winnerName = "",
    pointsAwarded = 0,
    gameEndReason = "checkmate",
    gameid = "",
    winnerid = ""
  } = gameResult || {};

  const reasonText = {
    checkmate: "by checkmate",
    timeout: "by timeout",
    resignation: "by resignation",
  };

  // Update user points and game history on the backend
  useEffect(() => {
    if (!gameResult) return;

    const updateBackend = async () => {
      try {
        // Check if user is logged in
        if (!authService.isLoggedIn()) {
          setError("User not logged in. Points and history not updated.");
          return;
        }

        const keycloakId = JwtService.getKeycloakId();
        if (!keycloakId) {
          setError("Unable to identify user. Points and history not updated.");
          return;
        }

        const currentUser = await userService.getCurrentUser(keycloakId);

        // Update points if it's a ranked match and the current user is the winner
        if (isRankedMatch && currentUser.username === winnerName) {
          await userService.updateUserPoints(currentUser.id, pointsAwarded);
          // Refresh user data after points update
          const updatedUser = await userService.getCurrentUser(keycloakId);
          localStorage.setItem("user", JSON.stringify(updatedUser));
        }

        // Complete game

        const history = await gameHistoryService.getGameHistoriesBySession(gameid);
        if (!history || !history.id) {
          throw new Error("Game history not found");
        }
        const historyId = history.id; // Assuming `id` is the field
        await gameHistoryService.completeGameHistory(historyId, gameResult);
      } catch (err) {
        console.error("Error updating backend:", err);
        setError("Failed to update points or game history. Please try again.");
      }
    };

    updateBackend();
  }, [gameResult, isRankedMatch, winnerName, pointsAwarded, gameid]);

  if (!gameResult) return null;

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
            {winnerName} wins {reasonText[gameEndReason]}!
          </h2>

          <div className="bg-muted p-4 rounded-md w-full text-center">
            <p className="text-sm text-muted-foreground mb-1">
              {isRankedMatch ? "Ranked Points Awarded" : "Casual Match - No Points Awarded"}
            </p>
            <p className="text-2xl font-bold text-primary">
              {isRankedMatch ? pointsAwarded : 0}
            </p>
          </div>

          {error && (
            <p className="text-red-500 text-sm text-center">{error}</p>
          )}

          <div className="flex flex-col sm:flex-row gap-2 w-full mt-4">
            <button
              className="flex-1 bg-primary/10 hover:bg-primary/20 text-primary font-medium py-2 rounded-md transition-colors"
              onClick={onPlayAgain}
            >
              Play Again
            </button>
            <button
              className="flex-1 bg-primary text-primary-foreground font-medium py-2 rounded-md hover:bg-primary/90 transition-colors"
              onClick={onClose}
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
