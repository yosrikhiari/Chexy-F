import {RPGBoardModifier} from '@/Interfaces/types/rpgChess.ts';

export interface RPGBoardModifierCard {
  modifier: RPGBoardModifier;
  onClick?: () => void;
}
