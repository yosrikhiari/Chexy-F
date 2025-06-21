import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.tsx';
import { Badge } from '@/components/ui/badge.tsx';
import { Grid, Check } from 'lucide-react';
import { cn } from '@/lib/utils.ts';
import { RPGBoardModifierCardProps } from '@/Interfaces/RPGBoardModifierCardProps.ts';
import {JwtService} from "@/services/JwtService.ts";
import {rpgGameService} from "@/services/RPGGameService.ts";

const RPGBoardModifierCard: React.FC<RPGBoardModifierCardProps> = ({ modifier, gameId, playerId, onApply }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'epic': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'rare': return 'bg-blue-100 text-blue-800 border-blue-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getEffectDescription = (effect: string) => {
    switch (effect) {
      case 'increase_size': return 'Increases board size';
      case 'decrease_size': return 'Decreases board size';
      case 'add_teleport_tiles': return 'Adds teleportation tiles';
      case 'add_boost_tiles': return 'Adds movement boost tiles';
      case 'add_trap_tiles': return 'Adds trap tiles';
      case 'add_portal_pairs': return 'Adds portal pairs';
      case 'add_pit_tiles': return 'Adds dangerous pit tiles';
      case 'add_slippery_tiles': return 'Adds slippery tiles that slide pieces';
      default: return effect.replace(/_/g, ' ').toUpperCase();
    }
  };

  const handleApplyModifier = async () => {
    if (modifier.isActive) return; // Prevent applying active modifiers
    if (!JwtService.getToken() || JwtService.isTokenExpired(JwtService.getToken()!)) {
      setError('Please log in to apply modifiers');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const updatedGameState = await rpgGameService.addBoardEffect(gameId, modifier, playerId);
      modifier.isActive = true; // Update local state
      onApply?.(modifier); // Notify parent
      console.log('Board modifier applied:', updatedGameState);
    } catch (err) {
      const errorMsg = `Failed to apply modifier: ${err.message}`;
      setError(errorMsg);
      console.error(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card
      className={cn(
        'relative transition-all',
        modifier.isActive ? 'ring-2 ring-green-400 ring-opacity-50 opacity-75' : 'cursor-pointer hover:shadow-lg hover:border-primary/50',
        isLoading && 'opacity-50 pointer-events-none'
      )}
      onClick={modifier.isActive || isLoading ? undefined : handleApplyModifier}
    >
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Grid className="h-5 w-5 text-blue-500" />
            {modifier.isActive && <Check className="h-4 w-4 text-green-500" />}
          </div>
          <Badge className={getRarityColor(modifier.rarity)}>
            {modifier.rarity}
          </Badge>
        </div>
        <CardTitle className="text-sm">{modifier.name}</CardTitle>
        <CardDescription className="text-xs">{modifier.description}</CardDescription>
      </CardHeader>

      <CardContent>
        <div className="p-2 bg-purple-50 rounded-md border-l-2 border-purple-400">
          <p className="text-xs font-medium text-purple-800">
            Effect: {getEffectDescription(modifier.effect)}
          </p>
        </div>

        {modifier.isActive && (
          <div className="mt-2 flex items-center gap-1 text-xs text-green-600">
            <Check className="h-3 w-3" />
            <span>Active</span>
          </div>
        )}

        {error && (
          <div className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded">
            {error}
          </div>
        )}

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-md">
            <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RPGBoardModifierCard;
