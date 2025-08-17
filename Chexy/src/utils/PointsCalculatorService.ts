import {JwtService} from '@/services/JwtService.ts';
import {userService} from '@/services/UserService.ts';
import {gameHistoryService} from '@/services/GameHistoryService.ts';


export interface StreakBasedPoints {
  pointsAwarded: number;
  newStreak: number;
  streakType: 'winning' | 'losing' | 'neutral';
  basePoints: number;
  streakBonus: number;
}

export class PointCalculationService {

  /**
   * Calculate points based on game outcome and current streak
   * @param isWinner - Whether the player won
   * @param isDraw - Whether the game was a draw
   * @param currentStreak - Player's current streak (positive for winning, negative for losing)
   * @param isRankedMatch - Whether this was a ranked match
   * @param moveCount - Number of moves made in the game (for draw point calculation)
   * @returns StreakBasedPoints object with calculation details
   */
  static calculateStreakBasedPoints(
    isWinner: boolean,
    isDraw: boolean,
    currentStreak: number,
    isRankedMatch: boolean,
    moveCount: number = 0
  ): StreakBasedPoints {

    if (!isRankedMatch) {
      return {
        pointsAwarded: 0,
        newStreak: 0,
        streakType: 'neutral',
        basePoints: 0,
        streakBonus: 0
      };
    }

    let basePoints = 0;
    let newStreak = 0;
    let streakType: 'winning' | 'losing' | 'neutral' = 'neutral';

    // Determine base points and new streak
    if (isWinner) {
      basePoints = 15; // Base points for winning
      newStreak = currentStreak >= 0 ? currentStreak + 1 : 1; // Reset negative streak or continue positive
      streakType = 'winning';
    } else if (isDraw) {
      // Only award draw points if game has at least 20 moves
      basePoints = moveCount >= 20 ? 5 : 0;
      newStreak = 0; // Draw resets streak
      streakType = 'neutral';
      console.log("[DEBUG] Draw points calculation - moveCount:", moveCount, "basePoints:", basePoints, "awardPoints:", moveCount >= 20);
    } else {
      basePoints = -8; // Base points for losing
      newStreak = currentStreak <= 0 ? currentStreak - 1 : -1; // Continue negative streak or start new one
      streakType = 'losing';
    }

    // Calculate streak bonus/penalty
    let streakBonus = 0;

    if (isWinner && newStreak > 1) {
      // Winning streak bonus: +2 points per win after the first
      streakBonus = Math.min((newStreak - 1) * 2, 10); // Cap at 10 bonus points
    } else if (!isWinner && !isDraw && Math.abs(newStreak) > 1) {
      // Losing streak penalty: -1 additional point per loss after the first
      streakBonus = -Math.min((Math.abs(newStreak) - 1) * 1, 5); // Cap at -5 penalty points
    }

    const totalPoints = basePoints + streakBonus;

    return {
      pointsAwarded: totalPoints,
      newStreak,
      streakType,
      basePoints,
      streakBonus
    };
  }

  /**
   * Apply calculated points to user account
   * @param userId - User ID to update
   * @param pointsToAdd - Points to add (can be negative)
   */
  static async applyPointsToUser(userId: string, pointsToAdd: number): Promise<void> {
    if (pointsToAdd === 0) return;

    try {
      await userService.updateUserPoints(userId, pointsToAdd);
      console.log(`[POINTS] Applied ${pointsToAdd} points to user ${userId}`);
    } catch (error) {
      console.error(`[POINTS] Failed to apply ${pointsToAdd} points to user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get current user's streak from their game stats or calculate from history
   * @returns Current streak value
   */
  static async getCurrentUserStreak(): Promise<number> {
    try {
      const keycloakId = JwtService.getKeycloakId();
      if (!keycloakId) throw new Error("User not authenticated");

      const user = await userService.getCurrentUser(keycloakId);

      // Try to get from user stats first
      if (user.gameStats?.currentStreak !== undefined) {
        return user.gameStats.currentStreak;
      }

      // Fallback to calculating from game history
      return await this.getCurrentUserStreakFromHistory();

    } catch (error) {
      console.error("[POINTS] Failed to get current user streak:", error);
      return 0;
    }
  }
  /**
   * Get current user's streak using game history service
   * @returns Current streak value
   */
  static async getCurrentUserStreakFromHistory(): Promise<number> {
    try {
      const keycloakId = JwtService.getKeycloakId();
      if (!keycloakId) throw new Error("User not authenticated");

      const user = await userService.getCurrentUser(keycloakId);
      const userId = user.id;

      // Get recent ranked games to calculate streak
      const recentGames = await gameHistoryService.getRankedGamesByUser(userId);

      if (!recentGames || recentGames.length === 0) {
        return 0; // No games = no streak
      }

      // Sort by most recent first
      recentGames.sort((a, b) => new Date(b.endTime || b.startTime).getTime() - new Date(a.endTime || a.startTime).getTime());

      let streak = 0;
      let lastResult: 'win' | 'loss' | 'draw' | null = null;

      for (const game of recentGames) {
        if (!game.result) continue;

        let currentResult: 'win' | 'loss' | 'draw';

        if (game.result.winner === "draw") {
          currentResult = 'draw';
        } else if (game.result.winnerid === userId) {
          currentResult = 'win';
        } else {
          currentResult = 'loss';
        }

        // If this is the first game or continues the streak
        if (lastResult === null) {
          lastResult = currentResult;
          if (currentResult === 'win') streak = 1;
          else if (currentResult === 'loss') streak = -1;
          else streak = 0; // draw breaks streak
        } else if (lastResult === currentResult && currentResult !== 'draw') {
          if (currentResult === 'win') streak++;
          else if (currentResult === 'loss') streak--;
        } else {
          // Streak broken
          break;
        }
      }

      console.log("[STREAK] Calculated streak from game history:", { userId, streak, gamesAnalyzed: recentGames.length });
      return streak;
    } catch (error) {
      console.error("[STREAK] Failed to get streak from game history:", error);
      return 0;
    }
  }

  /**
   * Get any user's streak using game history service
   */
  static async getUserStreakByUserId(userId: string): Promise<number> {
    try {
      const recentGames = await gameHistoryService.getRankedGamesByUser(userId);
      if (!recentGames || recentGames.length === 0) return 0;
      recentGames.sort((a, b) => new Date(b.endTime || b.startTime).getTime() - new Date(a.endTime || a.startTime).getTime());
      let streak = 0;
      let lastResult: 'win' | 'loss' | 'draw' | null = null;
      for (const game of recentGames) {
        if (!game.result) continue;
        let currentResult: 'win' | 'loss' | 'draw';
        if (game.result.winner === 'draw') currentResult = 'draw';
        else if (game.result.winnerid === userId) currentResult = 'win';
        else currentResult = 'loss';
        if (lastResult === null) {
          lastResult = currentResult;
          if (currentResult === 'win') streak = 1;
          else if (currentResult === 'loss') streak = -1;
          else streak = 0;
        } else if (lastResult === currentResult && currentResult !== 'draw') {
          if (currentResult === 'win') streak++;
          else if (currentResult === 'loss') streak--;
        } else {
          break;
        }
      }
      return streak;
    } catch (e) {
      console.error('[STREAK] Failed to get streak for user:', userId, e);
      return 0;
    }
  }

  /**
   * Process and apply points for an arbitrary user (winner/loser/draw) with idempotency.
   */
  static async processPointsForUser(
    gameResult: any,
    targetUserId: string,
    isRankedMatch: boolean,
    isWinner: boolean,
    isDraw: boolean,
    moveCount: number = 0
  ): Promise<StreakBasedPoints> {
    const targetStreak = await this.getUserStreakByUserId(targetUserId);
    const calc = this.calculateStreakBasedPoints(isWinner, isDraw, targetStreak, isRankedMatch, moveCount);

    if (calc.pointsAwarded !== 0) {
      const gameId: string = gameResult.gameid || gameResult.gameId || gameResult.id;
      const idempotencyKey = `points_processed:${gameId}:${targetUserId}`;
      const alreadyProcessed = localStorage.getItem(idempotencyKey);

      if (!alreadyProcessed) {
        try {
          // Get current user points for logging purposes
          const currentUser = await userService.getByUserId(targetUserId);
          const currentPoints = currentUser?.points || 0;

          // Apply the calculated points directly
          const pointsDelta = calc.pointsAwarded;

          await this.applyPointsToUser(targetUserId, pointsDelta);
          localStorage.setItem(idempotencyKey, JSON.stringify({
            applied: true,
            at: Date.now(),
            delta: pointsDelta,
            currentPoints: currentPoints,
            newTotal: currentPoints + pointsDelta
          }));
        } catch (error) {
          console.error("[POINTS] Failed to apply points to user:", targetUserId, error);
        }
      }
    }
    return calc;
  }
  /**
   * Calculate and apply points for a game result
   * @param gameResult - The game result
   * @param currentUserStreak - Current user's streak
   * @param isRankedMatch - Whether this was a ranked match
   * @param moveCount - Number of moves made in the game (for draw point calculation)
   * @returns Updated GameResult with calculated points
   */
  static async processGameResultPoints(
    gameResult: any,
    currentUserStreak: number,
    isRankedMatch: boolean,
    moveCount: number = 0
  ): Promise<{ gameResult: any; pointsCalculation: StreakBasedPoints }> {

    const keycloakId = JwtService.getKeycloakId();
    if (!keycloakId) {
      return { gameResult, pointsCalculation: this.calculateStreakBasedPoints(false, false, 0, false) };
    }

    const currentUser = await userService.getCurrentUser(keycloakId);
    const isWinner = gameResult.winnerid === currentUser.id;
    const isDraw = gameResult.winner === "draw" || gameResult.gameEndReason === "draw";

    // Calculate points based on streak
    const pointsCalculation = this.calculateStreakBasedPoints(
      isWinner,
      isDraw,
      currentUserStreak,
      isRankedMatch,
      moveCount // Pass move count for draw point calculation
    );

    // Idempotency: ensure we apply points ONCE per (gameId, userId)
    try {
      const gameId: string = gameResult.gameid || gameResult.gameId || gameResult.id;
      const idempotencyKey = `points_processed:${gameId}:${currentUser.id}`;
      const alreadyProcessed = localStorage.getItem(idempotencyKey);
      if (!alreadyProcessed && pointsCalculation.pointsAwarded !== 0) {
        await this.applyPointsToUser(currentUser.id, pointsCalculation.pointsAwarded);
        localStorage.setItem(idempotencyKey, JSON.stringify({ applied: true, at: Date.now(), delta: pointsCalculation.pointsAwarded }));
      } else if (alreadyProcessed) {
        console.log(`[POINTS] Skipping duplicate points application for key ${idempotencyKey}`);
      }
    } catch (e) {
      console.warn("[POINTS] Idempotency guard failed; continuing without cache:", e);
      if (pointsCalculation.pointsAwarded !== 0) {
        await this.applyPointsToUser(currentUser.id, pointsCalculation.pointsAwarded);
      }
    }

    // Update game result with calculated points
    const updatedGameResult = {
      ...gameResult,
      pointsAwarded: pointsCalculation.pointsAwarded
    };

    console.log(`[POINTS] Game result processed:`, {
      isWinner,
      isDraw,
      oldStreak: currentUserStreak,
      newStreak: pointsCalculation.newStreak,
      basePoints: pointsCalculation.basePoints,
      streakBonus: pointsCalculation.streakBonus,
      totalPoints: pointsCalculation.pointsAwarded
    });

    return { gameResult: updatedGameResult, pointsCalculation };
  }
}
