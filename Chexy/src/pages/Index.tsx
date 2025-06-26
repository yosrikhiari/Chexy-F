import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, User as UserIcon, Users } from "lucide-react";
import { JwtService } from "@/services/JwtService.ts";
import { userService } from "@/services/UserService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import ChessGameLayoutOverride from "@/components/InterfacesService/ChessGameLayout.tsx";
import { User } from "@/Interfaces/user/User";

const Index = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { isRankedMatch, mode } = location.state || { isRankedMatch: false, mode: "CLASSIC_MULTIPLAYER" };

  useEffect(() => {
    const initializeGame = async () => {
      try {
        const token = JwtService.getToken();
        if (!token || JwtService.isTokenExpired(token)) {
          navigate("/login");
          return;
        }

        const keycloakId = JwtService.getKeycloakId();
        if (!keycloakId) {
          throw new Error("No Keycloak ID found");
        }

        const userData = await userService.getCurrentUser(keycloakId);
        setUser(userData);

        const { gameId: stateGameId } = location.state || {};
        let newGameId: string;
        if (stateGameId) {
          newGameId = stateGameId;
        } else {
          const session = await gameSessionService.createGameSession(
            userData.id,
            mode,
            isRankedMatch
          );
          newGameId = session.gameId;
        }
        setGameId(newGameId);
      } catch (error) {
        console.error("Failed to initialize game:", error);
        navigate("/error", { state: { message: "Failed to start game. Please try again." } });
      } finally {
        setLoading(false);
      }
    };

    initializeGame();
  }, [navigate, location.state, isRankedMatch, mode]);

  useEffect(() => {
    if (!loading) {
      console.log("Rendering with:", { gameId, playerId: user?.id, mode });
    }
  }, [loading, gameId, user, mode]);

  if (loading) {
    return <div>Loading game...</div>;
  }

  if (!gameId || !user?.id) {
    return (
      <div className="text-center p-4 text-red-500">
        Error: Failed to start game. Please try again or contact support.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-mystical-gradient">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate("/game-select")}
              className="flex items-center gap-1"
              aria-label="Back to game selection"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/profile")}
              className="flex items-center gap-1"
              aria-label="Go to profile"
            >
              <UserIcon className="h-4 w-4" /> Profile
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/leaderboard")}
              className="flex items-center gap-1"
              aria-label="Go to leaderboard"
            >
              <Users className="h-4 w-4" /> Leaderboard
            </Button>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">
              Playing as: <span className="font-medium text-primary">{user?.username || "Guest"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Points: <span className="font-medium">{user?.points || 0}</span>
            </p>
          </div>
        </div>
        <ChessGameLayoutOverride
          className="pt-4 md:pt-8"
          isRankedMatch={isRankedMatch}
          gameId={gameId}
          playerId={user.id}
          mode={mode}
        />
      </div>
    </div>
  );
};

export default Index;
