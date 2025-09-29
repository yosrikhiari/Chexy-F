import { RPGGameState, RPGPiece, BoardEffect } from "./rpgChess.ts";
import { PieceColor, BoardPosition } from "./chess.ts";
import {AIStrategy} from '@/Interfaces/enums/AIStrategy.ts';

export interface EnhancedRPGPiece extends RPGPiece {
  pluscurrentHp: number;
  plusmaxHp: number;
  plusattack: number;
  plusdefense: number;
  pluslevel: number;
  plusexperience: number;
}

export interface EnemyArmyConfig {
  round: number;
  difficulty: number;
  pieces: EnhancedRPGPiece[];
  strategy: 'defensive' | 'aggressive' | 'balanced' | 'adaptive';
  queenExposed: boolean;
}

export interface DynamicBoardModifier {
  id: string;
  name: string;
  description: string;
  effect:
    | "increase_size"
    | "decrease_size"
    | "add_teleport_tiles"
    | "add_boost_tiles"
    | "add_trap_tiles"
    | "expose_queen";  // Add this
  rarity: "common" | "rare" | "epic" | "legendary";
  sizeModifier: number;
  isActive: boolean;
  minBoardSize?: number;
  maxBoardSize?: number;
  specialTiles?: number;
}

export interface EnhancedGameState extends RPGGameState {
  difficulty: number;
  enemyArmy: EnhancedRPGPiece[];
  aiStrategy: AIStrategy;
  teleportPortals: number;
  dragOffset: { x: number; y: number };
  viewportSize: { width: number; height: number };
  roundProgression: {
    baseBoardSize: number;
    sizeIncreasePerBoss: number;
    difficultyMultiplier: number;
  };
}

export interface CombatResult {
  attacker: EnhancedRPGPiece;
  defender: EnhancedRPGPiece;
  damage: number;
  defenderDefeated: boolean;
  attackerCounterDamage?: number;
}

export interface TeleportPortal {
  id: string;
  position: BoardPosition;
  to: BoardPosition;
  linkedPortal?: string;
  isActive: boolean;
}
