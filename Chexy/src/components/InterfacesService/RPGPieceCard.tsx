import React, { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card.tsx";
import { Badge } from "@/components/ui/badge.tsx";
import { Progress } from "@/components/ui/progress.tsx";
import { Button } from "@/components/ui/button.tsx";
import { Sword, Shield, Heart, Zap, Star } from "lucide-react";
import { toast } from "react-toastify";
import { RPGPiece, RPGModifier } from "@/Interfaces/types/rpgChess.ts";
import { EnhancedRPGPiece } from "@/Interfaces/types/enhancedRpgChess.ts";
import { RPGPieceCardProps } from "@/Interfaces/RPGPieceCardProps.ts";
import ChessPiece from "./ChessPiece.tsx";
import { rpgGameService } from "@/services/RPGGameService.ts";
import { enhancedRPGService } from "@/services/EnhancedRPGService.ts";
import { authService } from "@/services/AuthService.ts";
import { gameSessionService } from "@/services/GameSessionService.ts";
// Realtime broadcasting disabled for RPG games
import { JwtService } from "@/services/JwtService.ts";

const RPGPieceCard: React.FC<RPGPieceCardProps> = ({
                                                     piece,
                                                     onClick,
                                                     gameId,
                                                     playerId: propPlayerId,
                                                     gameMode,
                                                     onError,
                                                     onPieceUpdate,
                                                   }) => {
  const [currentPiece, setCurrentPiece] = useState<RPGPiece | EnhancedRPGPiece>(piece);
  const [isAddingPiece, setIsAddingPiece] = useState(false);
  const [isActivatingAbility, setIsActivatingAbility] = useState(false);

  // Resolve playerId
  const playerId = propPlayerId || JwtService.getKeycloakId();

  // Fetch updated piece data and validate game session
  useEffect(() => {
    const fetchPieceData = async () => {
      if (!gameId || !playerId || !authService.isLoggedIn()) {
        if (!authService.isLoggedIn()) {
          toast.error("Please log in to continue");
          onError?.("User not authenticated");
        }
        return;
      }

      try {
        // Fetch game state directly using RPG gameId
        const gameState = await rpgGameService.getRPGGame(gameId);
        const updatedPiece = [
          ...(gameState.playerArmy || []),
          ...(gameState.enemyArmy || []),
        ].find((p) => p.id === piece.id);

        if (updatedPiece) {
          setCurrentPiece(updatedPiece);
          onPieceUpdate?.(updatedPiece);
        }
      } catch (error) {
        const message = `Failed to fetch piece data: ${(error as Error).message}`;
        toast.error(message);
        onError?.(message);
      }
    };

    fetchPieceData();
  }, [gameId, playerId, piece.id, onError, onPieceUpdate]);

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

  const hpPercentage = (currentPiece.hp / currentPiece.maxHp) * 100;

  const handleCardClick = async () => {
    if (!onClick || !gameId || !playerId || !authService.isLoggedIn()) {
      if (!authService.isLoggedIn()) {
        toast.error("Please log in to continue");
        onError?.("User not authenticated");
      }
      if (onClick) onClick();
      return;
    }

    setIsAddingPiece(true);
    try {
      const gameState = await rpgGameService.getRPGGame(gameId);
      if (!gameState.playerArmy.some((p) => p.id === currentPiece.id)) {
        const updatedState = await rpgGameService.addPieceToArmy(gameId, currentPiece, playerId);
        setCurrentPiece(updatedState.playerArmy.find((p) => p.id === currentPiece.id) || currentPiece);
        onPieceUpdate?.(updatedState.playerArmy.find((p) => p.id === currentPiece.id) || currentPiece);
        // broadcasting disabled
        onPieceUpdate?.(updatedState.playerArmy.find((p) => p.id === currentPiece.id) || currentPiece);
        // broadcasting disabled
        toast.success(`${currentPiece.name} added to your army!`);
      } else {
        toast.info(`${currentPiece.name} is already in your army.`);
      }
      onClick();
    } catch (error) {
      const message = `Failed to add piece: ${(error as Error).message}`;
      toast.error(message);
      onError?.(message);
    } finally {
      setIsAddingPiece(false);
    }
  };

  const handleSpecialAbility = async () => {
    if (!gameId || !playerId || !currentPiece.specialAbility || !authService.isLoggedIn()) {
      if (!authService.isLoggedIn()) {
        toast.error("Please log in to continue");
        onError?.("User not authenticated");
      }
      return;
    }

    setIsActivatingAbility(true);
    try {
      if (gameMode === "ENHANCED_RPG" && "pluslevel" in currentPiece) {
        // Use enhancedRPGService for ENHANCED_RPG mode
        const combatResult = await enhancedRPGService.resolveCombat(
          currentPiece as EnhancedRPGPiece,
          currentPiece as EnhancedRPGPiece, // Self-targeted ability; adjust as needed
          gameId,
          playerId
        );
        setCurrentPiece(combatResult.attacker);
        onPieceUpdate?.(combatResult.attacker);
        // broadcasting disabled
        toast.success(`${currentPiece.specialAbility} activated!`);
      } else {
        // Use rpgGameService for other modes
        const modifier: RPGModifier = {
          id: `ability-${currentPiece.id}-${Date.now()}`,
          name: currentPiece.specialAbility,
          description: `Activated ${currentPiece.specialAbility} for ${currentPiece.name}`,
          effect: currentPiece.specialAbility.toLowerCase().replace(/\s/g, "_"),
          rarity: currentPiece.rarity as "common" | "rare" | "epic" | "legendary",
          isActive: true,
        };

        const updatedState = await rpgGameService.addModifier(gameId, modifier, playerId);
        setCurrentPiece(updatedState.playerArmy.find((p) => p.id === currentPiece.id) || currentPiece);
        onPieceUpdate?.(updatedState.playerArmy.find((p) => p.id === currentPiece.id) || currentPiece);
        // broadcasting disabled
        toast.success(`${currentPiece.specialAbility} activated!`);
      }
    } catch (error) {
      const message = `Failed to activate ability: ${(error as Error).message}`;
      toast.error(message);
      onError?.(message);
    } finally {
      setIsActivatingAbility(false);
    }
  };

  const isEnhancedPiece = (p: RPGPiece | EnhancedRPGPiece): p is EnhancedRPGPiece => {
    return "pluslevel" in p;
  };

  return (
    <Card
      className={`cursor-pointer hover:shadow-lg transition-all ${
        currentPiece.isJoker ? "ring-2 ring-yellow-400 ring-opacity-50" : ""
      } ${onClick ? "hover:border-primary/50" : ""}`}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChessPiece piece={{ type: currentPiece.type, color: currentPiece.color }} />
            {currentPiece.isJoker && <Zap className="h-4 w-4 text-yellow-500" />}
          </div>
          <Badge className={getRarityColor(currentPiece.rarity)}>
            {currentPiece.rarity}
          </Badge>
        </div>
        <CardTitle className="text-sm">{currentPiece.name}</CardTitle>
        <CardDescription className="text-xs">{currentPiece.description}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-2">
        {/* HP Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1">
              <Heart className="h-3 w-3 text-red-500" />
              <span>HP</span>
            </div>
            <span>{currentPiece.hp}/{currentPiece.maxHp}</span>
          </div>
          <Progress value={hpPercentage} className="h-2" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-1">
            <Sword className="h-3 w-3 text-red-600" />
            <span>ATK: {currentPiece.attack}</span>
          </div>
          <div className="flex items-center gap-1">
            <Shield className="h-3 w-3 text-blue-600" />
            <span>DEF: {currentPiece.defense}</span>
          </div>
          {isEnhancedPiece(currentPiece) && (
            <>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 text-yellow-600" />
                <span>Level: {currentPiece.pluslevel}</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="h-3 w-3 text-purple-600" />
                <span>EXP: {currentPiece.plusexperience}</span>
              </div>
            </>
          )}
        </div>

        {/* Special Ability */}
        {currentPiece.specialAbility && (
          <div className="mt-2 space-y-2">
            <div className="p-2 bg-yellow-50 rounded-md border-l-2 border-yellow-400">
              <p className="text-xs font-medium text-yellow-800">{currentPiece.specialAbility}</p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={(e) => {
                e.stopPropagation();
                handleSpecialAbility();
              }}
              disabled={isActivatingAbility || !gameId || !playerId}
              className="w-full text-xs"
            >
              {isActivatingAbility ? "Activating..." : "Activate Ability"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RPGPieceCard;
