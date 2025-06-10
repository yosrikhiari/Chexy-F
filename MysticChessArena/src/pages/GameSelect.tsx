import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Gamepad, Sword, Trophy, Check,
  User as UserIcon,
  Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { User } from "@/Interfaces/user/User";
import {JwtService} from "@/services/JwtService.ts";
import {userService} from "@/services/UserService.ts";
import {authService} from "@/services/AuthService.ts";

const GameSelect = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const token = JwtService.getToken();
        if (!token || JwtService.isTokenExpired(token)) {
          navigate("/login");
          return;
        }

        const keycloakId = JwtService.getKeycloakId();
        if (keycloakId) {
          const userData = await userService.getCurrentUser(keycloakId);
          setUser(userData);
        } else {
          setUser({ username: "Guest", points: 0, id: "", keycloakId: "", emailAddress: "", role: "USER", isActive: true } as User);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        try {
          const storedUser = JSON.parse(localStorage.getItem("user") || '{"username": "Guest", "points": 0}');
          setUser({ ...storedUser, id: "", keycloakId: "", emailAddress: "", role: "USER", isActive: true } as User);
        } catch (parseError) {
          console.error("Failed to parse localStorage user:", parseError);
          setUser({ username: "Guest", points: 0, id: "", keycloakId: "", emailAddress: "", role: "USER", isActive: true } as User);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate]);

  if (loading) {
    return <div className="text-center p-4">Loading...</div>;
  }

  const gameTypes = [
    {
      title: "RPG Adventure",
      description: "Embark on a cooperative roguelike chess journey",
      icon: <Gamepad className="h-8 w-8" />,
      comingSoon: false,
      path: "/rpg",
      isRanked: false,
    },
    {
      title: "Normal Match",
      description: "Play a standard game of chess",
      icon: <Sword className="h-8 w-8" />,
      comingSoon: false,
      path: "/",
      isRanked: false,
    },
    {
      title: "Ranked Match",
      description: "Test your skills and climb the leaderboard",
      icon: <Trophy className="h-8 w-8" />,
      comingSoon: false,
      path: "/",
      isRanked: true,
    },
  ];

  const handleSelectGame = (path: string, comingSoon: boolean, isRanked: boolean) => {
    if (comingSoon) {
      toast({
        title: "Coming Soon",
        description: "This game mode is not yet available",
      });
      return;
    }
    navigate(path, { state: { isRankedMatch: isRanked } });
  };

  const handleLogout = () => {
    authService.logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-mystical-gradient p-4 pt-8 md:pt-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-bold text-3xl sm:text-4xl md:text-5xl text-primary mb-2 animate-float">
            Mystic Chess Arena
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Welcome, {user?.username || "Guest"}! Select your adventure
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {gameTypes.map((game, index) => (
            <Card
              key={index}
              className={`cursor-pointer hover:border-primary/50 transition-all ${game.comingSoon ? "opacity-70" : ""}`}
              onClick={() => handleSelectGame(game.path, game.comingSoon, game.isRanked)}
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    {game.icon}
                  </div>
                  {game.comingSoon && (
                    <span className="bg-secondary text-secondary-foreground text-xs py-1 px-2 rounded-md">
                      Coming Soon
                    </span>
                  )}
                </div>
                <CardTitle className="mt-4">{game.title}</CardTitle>
                <CardDescription>{game.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {!game.comingSoon && (
                  <div className="flex items-center text-sm text-primary">
                    <Check className="mr-1 h-4 w-4" /> Available now
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center">
          <p className="text-muted-foreground">
            Your rank points: <span className="text-primary font-bold">{user?.points || 0}</span>
          </p>

          <div className="flex gap-4 mt-4">
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

            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              aria-label="Logout"
            >
              Logout
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GameSelect;
