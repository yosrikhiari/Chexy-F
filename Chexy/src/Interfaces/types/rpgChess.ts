import {PieceType, PieceColor, BoardPosition} from "./chess.ts";
import {EnhancedRPGPiece} from '@/Interfaces/types/enhancedRpgChess.ts';

export interface RPGPiece {
  id: string;
  type: PieceType;
  color: PieceColor;
  name: string;
  description: string;
  specialAbility: string;
  hp: number;
  maxHp: number;
  attack: number;
  defense: number;
  rarity: string;
  isJoker: boolean;
  position: BoardPosition;
  hasMoved: boolean;

  // Optional enhanced properties for compatibility
  pluscurrentHp?: number;
  plusmaxHp?: number;
  plusattack?: number;
  plusdefense?: number;
  pluslevel?: number;
  plusexperience?: number;
}





export interface RPGModifier {
  id: string;
  name: string;
  description: string;
  effect: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  isActive: boolean;
}

export interface BoardEffect {
  id: string;
  name: string;
  description: string;
  type: 'teleport' | 'boost' | 'trap' | 'portal' | 'size_modifier' | 'pit' | 'slippery';
  positions?: [number, number][];
  effect: any;
  isActive: boolean;
  intensity?: number; // For slippery tiles (1-3)
}

export interface RPGBoardModifier {
  id: string;
  name: string;
  description: string;
  effect: 'increase_size' | 'decrease_size' | 'add_teleport_tiles' | 'add_boost_tiles' | 'add_trap_tiles' | 'add_portal_pairs' | 'add_pit_tiles' | 'add_slippery_tiles';
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  boardSizeModifier?: number;
  specialTiles?: number;
  isActive: boolean;
}

export interface ArmyCapacity {
  maxTotalPieces: number;
  maxQueens: number;
  maxRooks: number;
  maxBishops: number;
  maxKnights: number;
  maxPawns: number;
  bonusCapacity: number; // From upgrades like "Mercenary Camp"
}

export interface CapacityModifier {
  id: string;
  name: string;
  description: string;
  type: 'total_capacity' | 'piece_type_limit' | 'board_synergy';
  pieceType?: PieceType;
  capacityBonus: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  isActive: boolean;
}

export interface RPGBoss {
  id: string;
  name: string;
  description: string;
  hp: number;
  maxHp: number;
  specialAbility: string;
  pieces: RPGPiece[];
  gimmick: string;
}

export interface RPGRound {
  roundNumber: number;
  boardSize: number;
  objective: 'checkmate' | 'survive' | 'capture_key' | 'boss_fight';
  turnLimit?: number;
  boss?: RPGBoss;
  rewards: (RPGPiece | RPGModifier | RPGBoardModifier | CapacityModifier)[];
  isBossRound?: boolean;
  coinsReward: number;
}

export interface RPGGameState {
  turnsRemaining?: number;
  gameSessionId?: string; // backend field
  gameId?: string; // normalized alias used by new code
  gameid: string; // legacy usage in FE, keep for now for compatibility
  currentRound: number;
  playerArmy: RPGPiece[];
  enemyArmy?: RPGPiece[];
  activeModifiers?: any[];
  activeBoardModifiers?: any[];
  activeCapacityModifiers?: any[];
  boardEffects?: BoardEffect[];
  boardSize: number;
  armyCapacity: ArmyCapacity;
  completedRounds?: number[];
  lives: number;
  score: number;
  coins: number;
  isGameOver: boolean;
  currentObjective: string;
  difficulty?: number;
}

export interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  highestRound: number;
  totalScore: number;
  totalCoinsEarned: number;
  unlockedPieces: string[];
  unlockedModifiers: string[];
}


export const isEnhancedRPGPiece = (piece: any): piece is EnhancedRPGPiece => {
  return piece && typeof piece === 'object' &&
    'pluslevel' in piece &&
    'plusexperience' in piece;
};

export const isRPGPiece = (piece: any): piece is RPGPiece => {
  return piece && typeof piece === 'object' &&
    'hp' in piece &&
    'attack' in piece &&
    'defense' in piece;
};

// Utility function to safely convert RPGPiece to EnhancedRPGPiece
export const toEnhancedRPGPiece = (piece: RPGPiece): EnhancedRPGPiece => {
  return {
    ...piece,
    pluscurrentHp: piece.pluscurrentHp ?? piece.hp,
    plusmaxHp: piece.plusmaxHp ?? piece.maxHp,
    plusattack: piece.plusattack ?? piece.attack,
    plusdefense: piece.plusdefense ?? piece.defense,
    pluslevel: piece.pluslevel ?? 1,
    plusexperience: piece.plusexperience ?? 0,
  } as EnhancedRPGPiece;
};

// Utility function to safely get enhanced stats from any piece
export const getEnhancedStats = (piece: RPGPiece) => {
  return {
    currentHp: piece.pluscurrentHp ?? piece.hp,
    maxHp: piece.plusmaxHp ?? piece.maxHp,
    attack: piece.plusattack ?? piece.attack,
    defense: piece.plusdefense ?? piece.defense,
    level: piece.pluslevel ?? 1,
    experience: piece.plusexperience ?? 0,
  };
};
