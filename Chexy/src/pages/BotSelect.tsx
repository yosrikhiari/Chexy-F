import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { User } from "@/Interfaces/user/User";
import { JwtService } from "@/services/JwtService.ts";
import { userService } from "@/services/UserService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
import { GameMode } from "@/Interfaces/enums/GameMode.ts";
import { AIStrategy } from "@/Interfaces/enums/AIStrategy.ts";
import { getDifficultyConfig, AI_DIFFICULTY_MAP } from "@/utils/AIDifficultyMapper.ts";

const BotSelect: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedDifficulty, setSelectedDifficulty] = useState<AIStrategy | null>(null);

  const { user: locationUser, isRanked, mode } = location.state || {};

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
        } else if (locationUser) {
          setUser(locationUser);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        if (locationUser) {
          setUser(locationUser);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [navigate, locationUser]);

  // Get all difficulty levels sorted by points
  const difficultyLevels = Object.entries(AI_DIFFICULTY_MAP)
    .filter(([key]) => ['novice', 'apprentice', 'journeyman', 'expert', 'master', 'grandmaster'].includes(key))
    .sort(([, a], [, b]) => a.points - b.points)
    .map(([key, config]) => ({
      strategy: key as AIStrategy,
      ...config
    }));

  const handleSelectBot = async (strategy: AIStrategy) => {
    if (!user) {
      toast({ title: "Error", description: "User data not found.", variant: "destructive" });
      return;
    }

    setSelectedDifficulty(strategy);

    try {
      const session = await gameSessionService.createGameSession(
        user.id,
        mode || "CLASSIC_SINGLE_PLAYER",
        isRanked || false
      );
      navigate("/", { 
        state: { 
          isRankedMatch: isRanked, 
          gameId: session.gameId, 
          playerId: user.id,
          mode: mode || "CLASSIC_SINGLE_PLAYER",
          aiStrategy: strategy
        } 
      });
    } catch (error) {
      toast({ title: "Error", description: "Failed to create game session.", variant: "destructive" });
      console.error("Game session creation failed:", error);
      setSelectedDifficulty(null);
    }
  };

  if (loading) {
    return (
      <div className="h-full bg-mystical-gradient flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-primary font-medieval text-lg">Summoning challengers...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-mystical-gradient p-4 flex flex-col">
      <div className="max-w-6xl mx-auto flex-1 flex flex-col">
        {/* Header */}
        <div className="text-center mb-6 flex-shrink-0">
          <h1 className="font-medieval text-3xl sm:text-4xl text-primary mb-3 animate-float">
            Choose Your Challenger
          </h1>
          <div className="w-20 h-1 bg-gradient-to-r from-primary to-accent mx-auto mb-3 rounded-full"></div>
          <p className="text-base text-muted-foreground font-elegant max-w-2xl mx-auto">
            Select your worthy opponent from the mystical realm - each with their own unique strength and personality
          </p>
        </div>

        



        <div className="flex flex-1 gap-6">
          {/* Bot Selection Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {difficultyLevels.map((bot, index) => {
                const config = getDifficultyConfig(bot.strategy);
                const isSelected = selectedDifficulty === bot.strategy;
                
                return (
                  <Card
                    key={index}
                    className={`rpg-card-hover cursor-pointer bg-card/80 backdrop-blur-sm border-2 transition-all duration-300 ${
                      isSelected 
                        ? 'border-primary shadow-lg scale-105' 
                        : 'border-border/50 hover:border-primary/50'
                    }`}
                    onClick={() => handleSelectBot(bot.strategy)}
                  >
                    <CardHeader className="text-center">
                      <div className="flex justify-center mb-4">
                        <div className={`w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mystical-glow ${
                          isSelected ? 'animate-pulse' : ''
                        }`}>
                          <span className="text-3xl">{bot.icon}</span>
                        </div>
                      </div>
                      <CardTitle className="font-medieval text-xl text-primary">{bot.name}</CardTitle>
                      <CardDescription className="font-elegant text-sm leading-relaxed">
                        {bot.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-3">
                        <Badge variant="outline" className="font-elegant text-xs">
                          {bot.points} pts
                        </Badge>
                        <Badge variant="secondary" className="font-elegant text-xs">
                          {bot.points <= 600 ? 'Beginner' : 
                          bot.points <= 800 ? 'Intermediate' : 
                          bot.points <= 1200 ? 'Advanced' : 
                          bot.points <= 1800 ? 'Expert' : 'Master'}
                        </Badge>
                      </div>
                      
                      {/* Characteristics */}
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground font-elegant mb-2">Characteristics:</p>
                        <div className="flex flex-wrap gap-1 justify-center">
                          {bot.characteristics.slice(0, 2).map((char, idx) => (
                            <span key={idx} className="text-xs bg-secondary/50 text-secondary-foreground px-2 py-1 rounded-full">
                              {char}
                            </span>
                          ))}
                        </div>
                      </div>

                      <Button 
                        variant="outline" 
                        className={`w-full fantasy-button font-elegant ${
                          isSelected ? 'bg-primary text-primary-foreground' : ''
                        }`}
                        disabled={isSelected}
                      >
                        {isSelected ? 'Selected' : 'Challenge'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          

          {/* Difficulty Level Guide */}
            <div className="w-64 flex-shrink-0 hidden lg:block">
              <div className="bg-card/50 backdrop-blur-sm rounded-lg p-4 border border-border/50 sticky top-4">
                <h3 className="font-medieval text-lg text-primary mb-4">Difficulty Guide</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
                    <span>Novice (400 pts)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-orange-400 rounded-full"></div>
                    <span>Apprentice (600 pts)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-cyan-400 rounded-full"></div>
                    <span>Journeyman (800 pts)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-400 rounded-full"></div>
                    <span>Expert (1200 pts)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-purple-400 rounded-full"></div>
                    <span>Master (1800 pts)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                    <span>Grandmaster (2400+ pts)</span>
                  </div>
                </div>
              </div>
            </div>

        </div>
        
        
        {/* Back Button */}
        <div className="mt-6 text-center flex-shrink-0">
          <Button 
            variant="ghost" 
            onClick={() => navigate("/game-select")}
            className="font-elegant text-muted-foreground hover:text-primary"
          >
            ← Return to Arena
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BotSelect;
