import { RPGModifier, RPGPiece, RPGBoardModifier, CapacityModifier } from "@/Interfaces/types/rpgChess";

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  cost: number;
  type: 'piece' | 'modifier' | 'board_modifier' | 'capacity_modifier';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  item: RPGPiece | RPGModifier | RPGBoardModifier | CapacityModifier;
}
