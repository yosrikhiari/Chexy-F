import {PlayerStats} from '@/Interfaces/types/chess.ts';
import {BoardEffect, RPGPiece} from '@/Interfaces/types/rpgChess.ts';
import {EnhancedRPGPiece} from '@/Interfaces/types/enhancedRpgChess.ts';

export interface GameStateData {
  gameId: string;
  currentRound: number;
  boardSize: number;
  playerArmy: RPGPiece[];
  enemyArmy: EnhancedRPGPiece[];
  boardEffects: BoardEffect[];
  playerStats: PlayerStats;
  difficulty: number;
}
