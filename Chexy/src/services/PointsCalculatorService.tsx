// PointCalculationService.ts
import { GameHistory } from "@/Interfaces/types/GameHistory";
import { gameHistoryService } from "./GameHistoryService";

export class PointCalculationService {

  /**
   * Calculate points based on match history streak
   * @param userId - The user ID to calculate points for
   * @param isWinner - Whether the user won the match
   * @param isDraw - Whether the match was a draw
   * @param isRankedMatch - Whether this is a ranked match
   * @returns Promise<number> - Points to award
   */
  static async calculatePoints(
    userId: string,
    isWinner: boolean,
    isDraw: boolean,
    isRankedMatch: boolean
  ): Promise<number> {
    // No points for casual matches
    if (!isRankedMatch) {
      return 0;
    }

    // No points for draws
    if (isDraw) {
      return 0;
    }

    // No points for losers
    if (!isWinner) {
      return 0;
    }

    try {
      // Get user's ranked game history
      const gameHistories = await gameHistoryService.getRankedGamesByUser(userId);

      // Sort by end time to get most recent games first
      const sortedHistories = gameHistories
        .filter(history => history.endTime) // Only completed games
        .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime());

      // Calculate current streak
      const currentStreak = this.calculateCurrentStreak(sortedHistories, userId);

      // Base points for a win
      let points = 12;

      // Streak bonus calculation
      if (currentStreak > 0) {
        // Win streak: +1 point per consecutive win, max +13 points (total 25)
        points += Math.min(currentStreak, 13);
      } else if (currentStreak < 0) {
        // Loss streak: +1 point per consecutive loss (comeback bonus), max +13 points (total 25)
        points += Math.min(Math.abs(currentStreak), 13);
      }

      return Math.min(points, 25); // Cap at 25 points

    } catch (error) {
      console.error("Error calculating points:", error);
      // Fallback to base points on error
      return 12;
    }
  }

  /**
   * Calculate the current win/loss streak for a user
   * @param gameHistories - Sorted game histories (most recent first)
   * @param userId - The user ID
   * @returns number - Positive for win streak, negative for loss streak, 0 for no streak
   */
  private static calculateCurrentStreak(gameHistories: GameHistory[], userId: string): number {
    if (gameHistories.length === 0) {
      return 0;
    }

    let streak = 0;
    let lastResult: 'win' | 'loss' | 'draw' | null = null;

    for (const history of gameHistories) {
      if (!history.result) continue;

      let currentResult: 'win' | 'loss' | 'draw';

      // Determine if this was a win, loss, or draw for the user
      if (history.result.winner === "draw") {
        currentResult = 'draw';
      } else if (history.result.winnerid === userId) {
        currentResult = 'win';
      } else {
        currentResult = 'loss';
      }

      // Skip draws when calculating streaks
      if (currentResult === 'draw') {
        continue;
      }

      // First non-draw game sets the streak direction
      if (lastResult === null) {
        lastResult = currentResult;
        streak = currentResult === 'win' ? 1 : -1;
      }
      // Continue streak if same result
      else if (lastResult === currentResult) {
        streak = currentResult === 'win' ? streak + 1 : streak - 1;
      }
      // Break streak if different result
      else {
        break;
      }
    }

    return streak;
  }

  /**
   * Get a description of the current streak for display
   */
  static getStreakDescription(streak: number): string {
    if (streak === 0) {
      return "No current streak";
    } else if (streak > 0) {
      return `${streak} win streak`;
    } else {
      return `${Math.abs(streak)} loss streak`;
    }
  }
}
