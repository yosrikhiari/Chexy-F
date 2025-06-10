import {PieceType, PieceColor, BoardPosition} from "./chess.ts";

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
  turnsRemaining: number;
  gameid: string;
  currentRound: number;
  playerArmy: RPGPiece[];
  enemyArmy?: RPGPiece[]; // Add optional enemyArmy property
  activeModifiers?: any[]; // Adjust type as needed
  activeBoardModifiers?: any[]; // Adjust type as needed
  activeCapacityModifiers?: any[]; // Adjust type as needed
  boardEffects?: BoardEffect[];
  boardSize: number;
  armyCapacity: {
    maxTotalPieces: number;
    maxQueens: number;
    maxRooks: number;
    maxBishops: number;
    maxKnights: number;
    maxPawns: number;
    bonusCapacity: number;
  };
  completedRounds?: any[]; // Adjust type as needed
  lives: number;
  score: number;
  coins: number;
  isGameOver: boolean;
  currentObjective: string;
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
