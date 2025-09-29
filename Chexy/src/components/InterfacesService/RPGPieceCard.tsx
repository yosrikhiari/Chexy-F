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
      // For locally purchased/shop pieces or enhanced RPG context, trust local state and skip server overrides
      const isShopItem = (piece?.id || '').toString().startsWith('shop-');
      if (isShopItem || gameMode === 'ENHANCED_RPG') {
        return;
      }
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
          // Merge server piece but prefer any enhanced fields from currentPiece to avoid losing local boosts
          const merged: any = {
            ...updatedPiece,
            pluscurrentHp: (currentPiece as any).pluscurrentHp ?? (updatedPiece as any).pluscurrentHp ?? updatedPiece.hp,
            plusmaxHp: (currentPiece as any).plusmaxHp ?? (updatedPiece as any).plusmaxHp ?? updatedPiece.maxHp,
            plusattack: (currentPiece as any).plusattack ?? (updatedPiece as any).plusattack ?? updatedPiece.attack,
            plusdefense: (currentPiece as any).plusdefense ?? (updatedPiece as any).plusdefense ?? updatedPiece.defense,
          };
          setCurrentPiece(merged);
          onPieceUpdate?.(merged);
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

  const effectiveHp = ('pluscurrentHp' in currentPiece ? (currentPiece as any).pluscurrentHp : currentPiece.hp) || 0;
  const effectiveMaxHp = ('plusmaxHp' in currentPiece ? (currentPiece as any).plusmaxHp : currentPiece.maxHp) || 1;
  const effectiveAttack = ('plusattack' in currentPiece ? (currentPiece as any).plusattack : currentPiece.attack) || 0;
  const effectiveDefense = ('plusdefense' in currentPiece ? (currentPiece as any).plusdefense : currentPiece.defense) || 0;
  const hpPercentage = Math.max(0, Math.min(100, (effectiveHp / effectiveMaxHp) * 100));

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
        // For enhanced RPG mode, use the proper ability activation endpoint
        let abilityId: string;
        const abilityName = currentPiece.specialAbility.toLowerCase();

        // Enhanced mapping to match backend AbilityId enum values
        switch (abilityName) {
          case 'heal':
          case 'healing':
            abilityId = 'HEAL_2';
            break;
          case 'shadow step':
          case 'shadowstep':
          case 'teleport':
            abilityId = 'SHADOW_STEP';
            break;
          case 'charge':
            abilityId = 'CHARGE';
            break;
          case 'guard':
          case 'shield':
            abilityId = 'SHIELD';
            break;
          case 'blink':
            abilityId = 'BLINK';
            break;
          case 'lunge':
            abilityId = 'LUNGE';
            break;
          case 'smite':
            abilityId = 'SMITE';
            break;
          case 'rally':
            abilityId = 'RALLY';
            break;
          case 'fortress':
            abilityId = 'FORTRESS';
            break;
          case 'barrage':
            abilityId = 'BARRAGE';
            break;
          case 'execute':
            abilityId = 'EXECUTE';
            break;
          case 'intimidate':
            abilityId = 'INTIMIDATE';
            break;
          case 'inspire':
            abilityId = 'INSPIRE';
            break;
          case 'sacrifice':
            abilityId = 'SACRIFICE';
            break;
          case 'divine intervention':
          case 'divineintervention':
            abilityId = 'DIVINE_INTERVENTION';
            break;
          case 'resurrection':
            abilityId = 'RESURRECTION';
            break;
          case 'time warp':
          case 'timewarp':
            abilityId = 'TIME_WARP';
            break;
          case 'meteor':
            abilityId = 'METEOR';
            break;
          case 'lightning':
            abilityId = 'LIGHTNING';
            break;
          case 'earthquake':
            abilityId = 'EARTHQUAKE';
            break;
          case 'blizzard':
            abilityId = 'BLIZZARD';
            break;
          case 'inferno':
            abilityId = 'INFERNO';
            break;
          case 'dark magic':
          case 'darkmagic':
            abilityId = 'DARK_MAGIC';
            break;
          case 'shadow strike':
          case 'shadowstrike':
            abilityId = 'SHADOW_STRIKE';
            break;
          default:
            // Try to convert the ability name to match enum pattern
            abilityId = currentPiece.specialAbility.toUpperCase().replace(/\s+/g, '_');
            break;
        }

        // Use the enhanced RPG service ability activation endpoint
        const updatedState = await enhancedRPGService.activateAbility(
          gameId,
          currentPiece.id,
          abilityId,
          null, // targetPieceId - could be enhanced to allow targeting
          playerId
        );

        // Update the piece from the returned game state
        const updatedPiece = updatedState.playerArmy?.find((p: any) => p.id === currentPiece.id) || currentPiece;
        setCurrentPiece(updatedPiece);
        onPieceUpdate?.(updatedPiece);
        toast.success(`${currentPiece.specialAbility} activated!`);

      } else {
        // For regular RPG mode, try the ability activation endpoint first
        try {
          // Use the same enhanced mapping for regular RPG mode
          let abilityId: string;
          const abilityName = currentPiece.specialAbility.toLowerCase();

          switch (abilityName) {
            case 'heal':
            case 'healing':
              abilityId = 'HEAL_2';
              break;
            case 'shadow step':
            case 'shadowstep':
            case 'teleport':
              abilityId = 'SHADOW_STEP';
              break;
            case 'charge':
              abilityId = 'CHARGE';
              break;
            case 'guard':
            case 'shield':
              abilityId = 'SHIELD';
              break;
            case 'blink':
              abilityId = 'BLINK';
              break;
            case 'lunge':
              abilityId = 'LUNGE';
              break;
            case 'smite':
              abilityId = 'SMITE';
              break;
            case 'rally':
              abilityId = 'RALLY';
              break;
            case 'fortress':
              abilityId = 'FORTRESS';
              break;
            case 'barrage':
              abilityId = 'BARRAGE';
              break;
            case 'execute':
              abilityId = 'EXECUTE';
              break;
            case 'intimidate':
              abilityId = 'INTIMIDATE';
              break;
            case 'inspire':
              abilityId = 'INSPIRE';
              break;
            case 'sacrifice':
              abilityId = 'SACRIFICE';
              break;
            case 'divine intervention':
            case 'divineintervention':
              abilityId = 'DIVINE_INTERVENTION';
              break;
            case 'resurrection':
              abilityId = 'RESURRECTION';
              break;
            case 'time warp':
            case 'timewarp':
              abilityId = 'TIME_WARP';
              break;
            case 'meteor':
              abilityId = 'METEOR';
              break;
            case 'lightning':
              abilityId = 'LIGHTNING';
              break;
            case 'earthquake':
              abilityId = 'EARTHQUAKE';
              break;
            case 'blizzard':
              abilityId = 'BLIZZARD';
              break;
            case 'inferno':
              abilityId = 'INFERNO';
              break;
            case 'dark magic':
            case 'darkmagic':
              abilityId = 'DARK_MAGIC';
              break;
            case 'shadow strike':
            case 'shadowstrike':
              abilityId = 'SHADOW_STRIKE';
              break;
            default:
              abilityId = currentPiece.specialAbility.toUpperCase().replace(/\s+/g, '_');
              break;
          }

          const updatedState = await enhancedRPGService.activateAbility(
            gameId,
            currentPiece.id,
            abilityId,
            null,
            playerId
          );

          const updatedPiece = updatedState.playerArmy?.find((p: any) => p.id === currentPiece.id) || currentPiece;
          setCurrentPiece(updatedPiece);
          onPieceUpdate?.(updatedPiece);
          toast.success(`${currentPiece.specialAbility} activated!`);

        } catch (abilityError) {
          // Fallback: if ability activation fails, try the modifier approach
          console.warn("Ability activation failed, trying modifier approach:", abilityError);

          const modifier = {
            id: `ability-${currentPiece.id}-${Date.now()}`,
            name: currentPiece.specialAbility,
            description: `Activated ${currentPiece.specialAbility} for ${currentPiece.name}`,
            effect: currentPiece.specialAbility.toLowerCase().replace(/\s+/g, "_"),
            rarity: currentPiece.rarity as "common" | "rare" | "epic" | "legendary",
            isActive: true,
            isPermanent: false,
            duration: 1,
            stackable: false
          };

          const updatedState = await rpgGameService.addModifier(gameId, modifier, playerId);
          const updatedPiece = updatedState.playerArmy?.find((p: any) => p.id === currentPiece.id) || currentPiece;
          setCurrentPiece(updatedPiece);
          onPieceUpdate?.(updatedPiece);
          toast.success(`${currentPiece.specialAbility} activated!`);
        }
      }
    } catch (error) {
      const message = `Failed to activate ability: ${(error as Error).message}`;
      toast.error(message);
      onError?.(message);

      // Enhanced error logging
      console.error("Special ability activation failed:", {
        gameId,
        playerId,
        pieceId: currentPiece.id,
        ability: currentPiece.specialAbility,
        gameMode,
        error: error
      });
    } finally {
      setIsActivatingAbility(false);
    }
  };

  const isEnhancedPiece = (p: RPGPiece | EnhancedRPGPiece): p is EnhancedRPGPiece => {
    return "pluslevel" in p;
  };

  return (
    <Card
      className={`cursor-pointer hover:shadow-lg transition-all h-80 flex flex-col ${
        currentPiece.isJoker ? "ring-2 ring-yellow-400 ring-opacity-50" : ""
      } ${onClick ? "hover:border-primary/50" : ""}`}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 flex-shrink-0">
              <ChessPiece piece={{ type: currentPiece.type, color: currentPiece.color }} />
            </div>
            {currentPiece.isJoker && <Zap className="h-4 w-4 text-yellow-500" />}
          </div>
          <Badge className={getRarityColor(currentPiece.rarity)}>
            {currentPiece.rarity}
          </Badge>
        </div>
        <CardTitle className="text-sm">{currentPiece.name}</CardTitle>
        <CardDescription className="text-xs">{currentPiece.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-between">
        <div className="space-y-2">
          {/* HP Bar */}
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <Heart className="h-3 w-3 text-red-500" />
                <span>HP</span>
              </div>
              <span>{effectiveHp}/{effectiveMaxHp}</span>
            </div>
            <Progress value={hpPercentage} className="h-2" />
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <Sword className="h-3 w-3 text-red-600" />
              <span>ATK: {effectiveAttack}</span>
            </div>
            <div className="flex items-center gap-1">
              <Shield className="h-3 w-3 text-blue-600" />
              <span>DEF: {effectiveDefense}</span>
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
