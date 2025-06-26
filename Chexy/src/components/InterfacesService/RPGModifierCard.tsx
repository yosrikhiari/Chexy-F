import React, { useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Zap, Check } from "lucide-react";
import { RPGModifier } from "@/Interfaces/types/rpgChess.ts";
import { RPGModifierCardProps } from "@/Interfaces/RPGModifierCardProps.ts";
import { toast } from "@/components/ui/use-toast.tsx";
import {JwtService} from "@/services/JwtService.ts";
import {rpgGameService} from "@/services/RPGGameService.ts";


interface EnhancedRPGModifierCardProps extends RPGModifierCardProps {
  gameId?: string; // Optional gameId to associate the modifier with a game
  playerId?: string; // Required playerId for rpgGameService.addModifier
}

const RPGModifierCard: React.FC<EnhancedRPGModifierCardProps> = ({ modifier, onClick, gameId, playerId }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localModifier, setLocalModifier] = useState<RPGModifier>(modifier);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case "legendary":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "epic":
        return "bg-purple-100 text-purple-800 border-purple-300";
      case "rare":
        return "bg-blue-100 text-blue-800 border-blue-300";
      default:
        return "bg-gray-100 text-gray-800 border-gray-300";
    }
  };

  // Handle click to apply or toggle the modifier via the backend
  const handleApplyModifier = useCallback(async () => {
    if (!gameId || !playerId) {
      toast({
        variant: "destructive",
        title: "Error",
        description: !gameId ? "No game ID provided." : "No player ID provided.",
      });
      return;
    }

    // Check if the user is logged in
    if (!JwtService.getToken() || JwtService.isTokenExpired(JwtService.getToken()!)) {
      toast({
        variant: "destructive",
        title: "Authentication Error",
        description: "Please log in to apply the modifier.",
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Call the backend to add/apply the modifier to the game
      const updatedGameState = await rpgGameService.addModifier(gameId, {
        id: localModifier.id,
        name: localModifier.name,
        description: localModifier.description,
        effect: localModifier.effect,
        rarity: localModifier.rarity,
        isActive: !localModifier.isActive, // Toggle the active state
      }, playerId);

      // Update local state with the new modifier status from the game state
      setLocalModifier((prev) => ({
        ...prev,
        isActive:
          updatedGameState.activeModifiers.find((m: RPGModifier) => m.id === localModifier.id)?.isActive ||
          false,
      }));

      // Call the onClick prop if provided
      if (onClick) {
        onClick();
      }

      toast({
        title: "Success",
        description: `Modifier ${localModifier.name} ${
          localModifier.isActive ? "deactivated" : "activated"
        } successfully!`,
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to apply modifier.";
      setError(errorMessage);
      toast({ variant: "destructive", title: "Error", description: errorMessage });
    } finally {
      setIsLoading(false);
    }
  }, [gameId, playerId, localModifier, onClick]);

  return (
    <Card
      className={`cursor-pointer hover:shadow-lg transition-all ${
        localModifier.isActive ? "ring-2 ring-green-400 ring-opacity-50" : ""
      } ${onClick || gameId ? "hover:border-primary/50" : ""} ${isLoading ? "opacity-50" : ""}`}
      onClick={gameId && playerId ? handleApplyModifier : onClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            {localModifier.isActive && <Check className="h-4 w-4 text-green-500" />}
          </div>
          <Badge className={getRarityColor(localModifier.rarity)}>{localModifier.rarity}</Badge>
        </div>
        <CardTitle className="text-sm">{localModifier.name}</CardTitle>
        <CardDescription className="text-xs">{localModifier.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="p-2 bg-blue-50 rounded-md border-l-2 border-blue-400">
          <p className="text-xs font-medium text-blue-800">
            Effect: {localModifier.effect.replace(/_/g, " ").toUpperCase()}
          </p>
        </div>

        {localModifier.isActive && (
          <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
            <Check className="h-3 w-3" />
            <span>Active</span>
          </div>
        )}

        {isLoading && <div className="mt-2 text-xs text-gray-600">Applying modifier...</div>}
        {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
      </CardContent>
    </Card>
  );
};

export default RPGModifierCard;
