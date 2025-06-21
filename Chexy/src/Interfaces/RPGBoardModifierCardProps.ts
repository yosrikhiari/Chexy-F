import {RPGBoardModifier} from '@/Interfaces/types/rpgChess.ts';

export interface RPGBoardModifierCardProps {
  modifier: RPGBoardModifier;
  gameId: string; // For backend calls to identify the game
  playerId: string; // For backend calls to authenticate the player
  onApply?: (modifier: RPGBoardModifier) => void; // Optional callback after successful application
}
