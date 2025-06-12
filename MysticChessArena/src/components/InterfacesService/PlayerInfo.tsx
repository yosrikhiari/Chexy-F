import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils.ts";
import { PieceColor } from "@/Interfaces/types/chess.ts";
import { User } from "@/Interfaces/user/User.ts";
import { GameSession } from "@/Interfaces/types/GameSession.ts";
import { PlayerInfoProps } from "@/Interfaces/PlayerInfoProps.ts";
import { userService } from "@/services/UserService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";

const PlayerInfo: React.FC<PlayerInfoProps> = ({
                                                 name,
                                                 points,
                                                 color,
                                                 isCurrentPlayer,
                                                 className,
                                                 player1Name,
                                                 player2Name,
                                                 currentPlayer,
                                                 userId,
                                                 gameId,
                                               }) => {
  const [displayName, setDisplayName] = useState<string>(
    name || (color === "white" ? player1Name : player2Name) || "Unknown"
  );
  const [playerPoints, setPlayerPoints] = useState<number>(points || 0);
  const [isActive, setIsActive] = useState<boolean>(
    isCurrentPlayer || currentPlayer === color || false
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch user data if userId is provided
        if (userId) {
          const user: User = await userService.getByUserId(userId);
          if (user) {
            setDisplayName(user.username || "Unknown");
            setPlayerPoints(user.points || 0);
          } else {
            setDisplayName("Unknown");
            setPlayerPoints(0);
          }
        }

        // Fetch game session data if gameId is provided
        if (gameId) {
          const gameSession: GameSession = await gameSessionService.getGameSession(gameId);
          const player = color === "white" ? gameSession.whitePlayer : gameSession.blackPlayer;

          if (player) {
            // Set display name with fallback chain
            setDisplayName(
              name || player.displayName || (color === "white" ? player1Name : player2Name) || "Unknown"
            );
            // Safely access points with fallback
            setPlayerPoints(points || (player.currentStats?.points ?? 0));
            // Determine if the player is active
            setIsActive(isCurrentPlayer || gameSession.gameState?.currentTurn === color);
          } else {
            // Handle case where player is not found
            setDisplayName(
              name || (color === "white" ? player1Name : player2Name) || "Unknown"
            );
            setPlayerPoints(points || 0);
            setIsActive(isCurrentPlayer || false);
          }
        }
      } catch (err) {
        setError("Failed to load player data");
        setDisplayName("Unknown");
        setPlayerPoints(0);
        setIsActive(false);
        console.error("Error fetching player info:", err);
      } finally {
        setLoading(false);
      }
    };

    if (userId || gameId) {
      fetchData();
    }
  }, [userId, gameId, name, points, color, isCurrentPlayer, player1Name, player2Name, currentPlayer]);

  return (
    <div
      className={cn(
        "py-2 px-4 rounded-lg text-center font-medium transition-all duration-200",
        isActive ? "bg-primary/20 ring-2 ring-primary scale-105" : "bg-secondary/50",
        className
      )}
    >
      {loading && <div className="text-xs text-muted-foreground">Loading...</div>}
      {error && <div className="text-xs text-red-500">{error}</div>}
      <div className="text-sm text-muted-foreground mb-1">
        {color === "white" ? "White" : "Black"}
      </div>
      <div className="text-md md:text-lg truncate">{displayName}</div>
      <div className="text-xs text-muted-foreground">Points: {playerPoints}</div>
    </div>
  );
};

export default PlayerInfo;
