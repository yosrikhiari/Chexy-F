import { RPGGameState } from '@/Interfaces/types/rpgChess.ts';
import {JwtService} from '@/services/JwtService.ts';

export class GoldManagementService {
  baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

  /**
   * Calculate gold bonus based on owned cards/modifiers
   * Gold Multiplier card: +10% per card owned
   */
  calculateGoldBonus(gameState: RPGGameState): number {
    if (!gameState.activeModifiers) return 0;

    const goldMultiplierCards = gameState.activeModifiers.filter(
      mod => mod.effect?.toLowerCase().includes('gold_multiplier') ||
        mod.name?.toLowerCase().includes('gold multiplier')
    );

    // 10% bonus per gold multiplier card
    const bonusPercentage = goldMultiplierCards.length * 10;
    return bonusPercentage;
  }

  /**
   * Calculate round completion gold reward
   * Base: 100 coins + round number * 10 + card bonuses
   */
  calculateRoundReward(currentRound: number, cardBonus: number): number {
    const baseReward = 100;
    const roundBonus = currentRound * 10;
    const totalBeforeBonus = baseReward + roundBonus;

    // Apply percentage bonus from cards
    const bonusAmount = Math.floor(totalBeforeBonus * (cardBonus / 100));

    return totalBeforeBonus + bonusAmount;
  }

  /**
   * Award gold at round completion with proper persistence
   */
  async awardRoundGold(
    gameId: string,
    currentRound: number,
    playerId: string,
    gameState: RPGGameState
  ): Promise<{ updatedState: RPGGameState; goldAwarded: number }> {
    try {
      // Calculate bonuses
      const cardBonus = this.calculateGoldBonus(gameState);
      const goldToAward = this.calculateRoundReward(currentRound, cardBonus);

      console.log(`[GOLD] Round ${currentRound} completion:`, {
        baseReward: 100 + currentRound * 10,
        cardBonus: `${cardBonus}%`,
        totalAwarded: goldToAward,
        currentCoins: gameState.coins
      });

      // Update gold via backend
      const response = await fetch(
        `${this.baseUrl}/rpg-game/coins/${gameId}?coinsToAdd=${goldToAward}&playerId=${playerId}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${JwtService.getToken()}` }
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to award gold: ${response.status}`);
      }

      const updatedState = await response.json();

      console.log(`[GOLD] Award successful. New total: ${updatedState.coins}`);

      return {
        updatedState,
        goldAwarded: goldToAward
      };

    } catch (error) {
      console.error("[GOLD] Failed to award round gold:", error);
      throw error;
    }
  }

  /**
   * Verify gold persistence across rounds
   */
  async verifyGoldPersistence(gameId: string): Promise<number> {
    try {
      const response = await fetch(`${this.baseUrl}/rpg-game/${gameId}`, {
        headers: { Authorization: `Bearer ${JwtService.getToken()}` }
      });

      if (!response.ok) {
        throw new Error("Failed to fetch game state");
      }

      const gameState: RPGGameState = await response.json();
      return gameState.coins;

    } catch (error) {
      console.error("[GOLD] Failed to verify persistence:", error);
      throw error;
    }
  }

  /**
   * Safe gold deduction for purchases
   */
  async deductGold(
    gameId: string,
    amount: number,
    playerId: string
  ): Promise<RPGGameState> {
    try {
      const negativeAmount = -Math.abs(amount);

      const response = await fetch(
        `${this.baseUrl}/rpg-game/coins/${gameId}?coinsToAdd=${negativeAmount}&playerId=${playerId}`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${JwtService.getToken()}` }
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || `Failed to deduct gold: ${response.status}`);
      }

      const updatedState = await response.json();

      console.log(`[GOLD] Deducted ${amount}. Remaining: ${updatedState.coins}`);

      return updatedState;

    } catch (error) {
      console.error("[GOLD] Failed to deduct gold:", error);
      throw error;
    }
  }

  /**
   * Get detailed gold breakdown for UI display
   */
  getGoldBreakdown(gameState: RPGGameState): {
    currentGold: number;
    cardBonuses: Array<{ name: string; bonus: string }>;
    nextRoundReward: number;
  } {
    const cardBonus = this.calculateGoldBonus(gameState);
    const nextRoundReward = this.calculateRoundReward(
      gameState.currentRound + 1,
      cardBonus
    );

    const cardBonuses = (gameState.activeModifiers || [])
      .filter(mod =>
        mod.effect?.toLowerCase().includes('gold_multiplier') ||
        mod.name?.toLowerCase().includes('gold multiplier')
      )
      .map(mod => ({
        name: mod.name,
        bonus: '+10%'
      }));

    return {
      currentGold: gameState.coins,
      cardBonuses,
      nextRoundReward
    };
  }
}

export const goldManagementService = new GoldManagementService();

// ===== INTEGRATION HELPERS =====

/**
 * Use this in completeBattle function after victory
 */
export async function handleVictoryGoldReward(
  gameState: RPGGameState,
  playerId: string
): Promise<{ updatedState: RPGGameState; goldAwarded: number }> {
  return await goldManagementService.awardRoundGold(
    gameState.gameId!,
    gameState.currentRound,
    playerId,
    gameState
  );
}

/**
 * Use this in shop purchases
 */
export async function handleShopPurchase(
  gameId: string,
  itemCost: number,
  playerId: string
): Promise<RPGGameState> {
  return await goldManagementService.deductGold(gameId, itemCost, playerId);
}
