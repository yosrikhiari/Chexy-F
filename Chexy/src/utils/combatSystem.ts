import { EnhancedRPGPiece, CombatResult } from "@/Interfaces/types/enhancedRpgChess";
import { enhancedRPGService } from '@/services/EnhancedRPGService.ts';
import { rpgGameService } from '@/services/RPGGameService.ts';

// Resolves combat using the backend EnhancedRPGService
export const resolveCombat = async (
  attacker: EnhancedRPGPiece,
  defender: EnhancedRPGPiece,
  gameId: string,
  playerId: string,
  isAttackerPlayerPiece: boolean // NEW: Flag to identify if attacker is player's piece
): Promise<CombatResult> => {
  try {
    const result = await enhancedRPGService.resolveCombat(attacker, defender, gameId, playerId);

    // Log combat details for debugging
    console.log(`Combat: ${attacker.name} dealt ${result.damage} damage to ${defender.name}`);
    if (result.attackerCounterDamage && result.attackerCounterDamage > 0) {
      console.log(`Counter: ${defender.name} dealt ${result.attackerCounterDamage} counter damage to ${attacker.name}`);
    }

    // ONLY track kills if:
    // 1. Attacker is a PLAYER piece
    // 2. Defender was defeated (HP reached 0)
    if (isAttackerPlayerPiece && result.defenderDefeated) {
      try {
        await rpgGameService.trackKill(gameId, attacker.id, playerId);
        console.log(`Kill tracked for player piece: ${attacker.name}`);
      } catch (error) {
        console.error("Failed to track kill:", error);
        // Don't throw - combat already resolved
      }
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

// Levels up a piece (ONLY for player pieces now)
export const levelUpPiece = (piece: EnhancedRPGPiece): void => {
  piece.pluslevel += 1;
  piece.plusmaxHp += 5;
  piece.pluscurrentHp = piece.maxHp + piece.plusmaxHp; // Reset to total max HP
  piece.plusattack += 2;
  piece.plusdefense += 1;
  piece.plusexperience = 0;

  console.log(`${piece.name} leveled up to level ${piece.pluslevel}!`);
};

// Adds experience to a piece (ONLY for player pieces)
export const gainExperience = (piece: EnhancedRPGPiece, amount: number): void => {
  piece.plusexperience += amount;
  const expNeeded = piece.pluslevel * 10;

  if (piece.plusexperience >= expNeeded) {
    levelUpPiece(piece);
  }
};
