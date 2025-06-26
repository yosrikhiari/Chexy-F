import { EnhancedRPGPiece, CombatResult } from "@/Interfaces/types/enhancedRpgChess";
import {enhancedRPGService} from '@/services/EnhancedRPGService.ts';

// Resolves combat using the backend EnhancedRPGService
export const resolveCombat = async (
  attacker: EnhancedRPGPiece,
  defender: EnhancedRPGPiece,
  gameId: string,
  playerId: string
): Promise<CombatResult> => {
  try {
    const result = await enhancedRPGService.resolveCombat(attacker, defender, gameId, playerId);

    // Log combat details for debugging
    console.log(`Combat: ${attacker.name} dealt ${result.damage} damage to ${defender.name}`);
    if (result.attackerCounterDamage && result.attackerCounterDamage > 0) {
      console.log(`Counter: ${defender.name} dealt ${result.attackerCounterDamage} counter damage to ${attacker.name}`);
    }

    return result;
  } catch (error) {
    console.error("Failed to resolve combat:", error);
    throw new Error("Combat resolution failed");
  }
};

// Heals a piece by a specified amount, capped at maxHp + plusmaxHp
export const healPiece = (piece: EnhancedRPGPiece, amount: number): void => {
  const totalMaxHp = piece.maxHp + piece.plusmaxHp;
  piece.pluscurrentHp = Math.min(totalMaxHp, piece.pluscurrentHp + amount);
};

// Levels up a piece, increasing stats and resetting experience
export const levelUpPiece = (piece: EnhancedRPGPiece): void => {
  piece.pluslevel += 1;
  piece.plusmaxHp += 5;
  piece.pluscurrentHp = piece.maxHp + piece.plusmaxHp; // Reset to total max HP
  piece.plusattack += 2;
  piece.plusdefense += 1;
  piece.plusexperience = 0;

  console.log(`${piece.name} leveled up to level ${piece.pluslevel}!`);
};

// Adds experience to a piece, triggering level up if threshold is reached
export const gainExperience = (piece: EnhancedRPGPiece, amount: number): void => {
  piece.plusexperience += amount;
  const expNeeded = piece.pluslevel * 10;

  if (piece.plusexperience >= expNeeded) {
    levelUpPiece(piece);
  }
};
