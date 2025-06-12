import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {Bot, bots} from "@/Interfaces/Bot";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { gameSessionService } from "@/services/GameSessionService";
import { GameMode } from "@/Interfaces/enums/GameMode";
import { User } from "@/Interfaces/user/User";

const BotSelect = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const location = useLocation();
  const { user, isRanked, mode } = location.state as { user: User; isRanked: boolean; mode: GameMode };

  const handleSelectBot = async (bot: Bot) => {
    try {
      const session = await gameSessionService.createGameSession(
        user.id,
        mode,  // Now "CLASSIC_SINGLE_PLAYER" from GameSelect
        true,
        null,
        bot.id  // Pass the selected bot's ID
      );
      toast({
        title: "Game Started",
        description: `You're playing against ${bot.name} (${bot.points} points)!`,
      });
      navigate("/", {
        state: { isRankedMatch: isRanked, gameId: session.gameId, playerId: user.id },
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to start game with bot.",
        variant: "destructive",
      });
      console.error("Bot game session creation failed:", error);
    }
  };

  return (
    <div className="min-h-screen bg-mystical-gradient p-4 pt-8 md:pt-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="font-bold text-3xl sm:text-4xl md:text-5xl text-primary mb-2">
            Choose Your Opponent
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Select a bot to challenge in a Normal Match
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {bots.map((bot) => (
            <Card
              key={bot.id}
              className="cursor-pointer hover:border-primary/50 transition-all"
              onClick={() => handleSelectBot(bot)}
            >
              <CardHeader>
                <CardTitle>{bot.name}</CardTitle>
                <CardDescription>
                  Difficulty: {bot.points} points
                  <br />
                  {bot.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button className="w-full">Play {bot.name}</Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <Button variant="outline" onClick={() => navigate("/game-select")}>
            Back to Game Select
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BotSelect;
