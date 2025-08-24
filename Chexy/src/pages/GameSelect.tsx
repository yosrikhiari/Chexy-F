import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { User } from "@/Interfaces/user/User";
import { JwtService } from "@/services/JwtService.ts";
import {UserService, userService} from "@/services/UserService.ts";
import { authService } from "@/services/AuthService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { GameMode } from "@/Interfaces/enums/GameMode.ts";
import { GameType } from "@/Interfaces/GameType.ts";

const GameSelect: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const fetchUserData = async (): Promise<void> => {
      try {
        const token = JwtService.getToken();
        if (!token || JwtService.isTokenExpired(token)) {
          navigate("/login");
          return;
        }

        const keycloakId = JwtService.getKeycloakId();
        if (keycloakId) {
          const userData: User = await userService.getCurrentUser(keycloakId);
          setUser(userData);
        } else {
          setUser({
            username: "Guest",
            points: 0,
            id: "",
            keycloakId: "",
            emailAddress: "",
            role: "USER",
            isActive: true,
          } as User);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        setUser({
          username: "Guest",
          points: 0,
          id: "",
          keycloakId: "",
          emailAddress: "",
          role: "USER",
          isActive: true,
        } as User);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  const gameTypes: GameType[] = [
    {
      title: "RPG Adventure",
      description: "Embark on a cooperative roguelike chess journey through mystical realms",
      icon: <span className="text-2xl">⚔️</span>,
      comingSoon: false,
      path: "/rpg",
      isRanked: false,
      mode: "SINGLE_PLAYER_RPG" as GameMode,
    },
    {
      title: "Normal Match",
      description: "Challenge the ancient chess masters in a standard duel",
      icon: <span className="text-2xl">♟️</span>,
      comingSoon: false,
      path: "/bot-select",
      isRanked: false,
      mode: "CLASSIC_SINGLE_PLAYER" as GameMode,
    },
    {
      title: "Ranked Match",
      description: "Prove your worth in the grand tournament of champions",
      icon: <span className="text-2xl">👑</span>,
      comingSoon: false,
      path: "/lobby",
      isRanked: true,
      mode: "CLASSIC_MULTIPLAYER" as GameMode,
    },
  ];

  const handleSelectGame = async (
    path: string,
    comingSoon: boolean,
    isRanked: boolean,
    mode: GameMode
  ): Promise<void> => {
    if (comingSoon) return;

    if (!user || !authService.isLoggedIn()) {
      toast({ title: "Error", description: "Please log in to start a game.", variant: "destructive" });
      navigate("/login");
      return;
    }

    if (path === "/bot-select") {
      navigate(path, { state: { user, isRanked, mode } });
    } else if (path === "/lobby") {
      navigate(path, { state: { user, isRanked, mode } });
    } else {
      try {
        const session = await gameSessionService.createGameSession(user.id, mode, isRanked);
        navigate(path, { state: { isRankedMatch: isRanked, gameId: session.gameId, playerId: user.id } });
      } catch (error) {
        toast({ title: "Error", description: "Failed to create game session.", variant: "destructive" });
        console.error("Game session creation failed:", error);
      }
    }
  };

  const handleLogout = (): void => {
    authService.logout();
    navigate("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-mystical-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-primary font-medieval text-lg">Summoning the arena...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-mystical-gradient p-4 flex flex-col">
      <div className="max-w-6xl mx-auto flex-1 flex flex-col">
        {/* Hero Section */}
        <div className="text-center mb-6 flex-shrink-0">
          <div className="mb-4">
            <h1 className="font-medieval text-3xl sm:text-4xl md:text-5xl text-primary mb-3 animate-float">
              Choose Your Adventure
            </h1>
            <div className="w-20 h-1 bg-gradient-to-r from-primary to-accent mx-auto mb-3 rounded-full"></div>
            <p className="text-base sm:text-lg text-muted-foreground font-elegant max-w-2xl mx-auto">
              Welcome, brave {user?.username || "Adventurer"}! Choose your path to glory
            </p>
          </div>
          
          {/* Player Stats */}
          <div className="bg-card/50 backdrop-blur-sm rounded-lg p-3 border border-border/50 mystical-glow max-w-md mx-auto">
            <p className="text-sm text-muted-foreground font-elegant">
              Your mystical power: <span className="text-primary font-bold text-lg">{user?.points || 0}</span>
            </p>
          </div>
        </div>

        {/* Game Selection Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1">
          {gameTypes.map((game, index) => (
            <Card
              key={index}
              className={`rpg-card-hover cursor-pointer border-2 ${game.comingSoon ? "opacity-70" : "hover:border-primary/50"} bg-card/80 backdrop-blur-sm`}
              onClick={() => handleSelectGame(game.path, game.comingSoon, game.isRanked, game.mode)}
            >
              <CardHeader className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mystical-glow">
                    <span className="text-3xl">{game.icon}</span>
                  </div>
                </div>
                {game.comingSoon && (
                  <div className="absolute top-4 right-4">
                    <span className="bg-secondary text-secondary-foreground text-xs py-1 px-3 rounded-full font-elegant">
                      Coming Soon
                    </span>
                  </div>
                )}
                <CardTitle className="font-medieval text-2xl text-primary">{game.title}</CardTitle>
                <CardDescription className="font-elegant text-base leading-relaxed">
                  {game.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                {!game.comingSoon && (
                  <div className="flex items-center justify-center text-sm text-primary font-elegant">
                    <span className="mr-2">✨</span> Ready for battle
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom Navigation */}
        <div className="mt-6 flex flex-col items-center flex-shrink-0">
          <div className="flex gap-4 mb-4">
            <Button 
              variant="outline" 
              size="default"
              onClick={() => navigate("/profile")}
              className="fantasy-button font-elegant"
            >
              📜 Scroll of Legends
            </Button>
            <Button 
              variant="outline" 
              size="default"
              onClick={() => navigate("/leaderboard")}
              className="fantasy-button font-elegant"
            >
              🏆 Hall of Fame
            </Button>
          </div>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={handleLogout}
            className="font-elegant text-muted-foreground hover:text-primary"
          >
            Leave the Arena
          </Button>
        </div>
      </div>
    </div>
  );
};

export default GameSelect;
