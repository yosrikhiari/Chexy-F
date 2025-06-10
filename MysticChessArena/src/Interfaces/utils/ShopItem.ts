import {RPGModifier, RPGPiece} from '@/Interfaces/types/rpgChess.ts';

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: 'piece' | 'modifier';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  item: RPGPiece | RPGModifier;
}
