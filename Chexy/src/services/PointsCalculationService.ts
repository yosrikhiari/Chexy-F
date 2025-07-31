import { GameHistory } from "@/Interfaces/types/GameHistory";
import { GameResult } from "@/Interfaces/types/chess";
import { gameHistoryService } from "./GameHistoryService";
import { userService } from "./UserService";
import { JwtService } from "./JwtService";

interface PointsCalculation {
  winnerPoints: number;
  loserPoints: number;
  winnerStreak: number;
  loserStreak: number;
}

export class PointsAttributionService {
  private readonly BASE_POINTS = 13;
  private readonly MAX_POINTS = 20;
  private readonly MIN_POINTS = 13;

  /**
   * Calculate points for both winner and loser based on their streaks
   */
  async calculatePoints(
    winnerId: string,
    loserId: string,
    isDraw: boolean = false
  ): Promise<PointsCalculation> {
    try {
      // Get game histories for both players
      const [winnerHistory, loserHistory] = await Promise.all([
        gameHistoryService.getGameHistoriesByUser(winnerId),
        gameHistoryService.getGameHistoriesByUser(loserId)
      ]);

      // Calculate streaks
      const winnerStreak = this.calculateWinStreak(winnerHistory, winnerId);
      const loserStreak = this.calculateLossStreak(loserHistory, loserId);

      if (isDraw) {
        // In case of draw, both players get minimal points
        return {
          winnerPoints: this.MIN_POINTS,
          loserPoints: -this.MIN_POINTS,
          winnerStreak,
          loserStreak
        };
      }

      // Calculate points based on streaks
      const winnerPoints = this.calculateWinnerPoints(winnerStreak);
      const loserPoints = this.calculateLoserPoints(loserStreak);

      return {
        winnerPoints,
        loserPoints: -loserPoints, // Negative because they're losing points
        winnerStreak,
        loserStreak
      };

    } catch (error) {
      console.error("Error calculating points:", error);
      // Fallback to base points if calculation fails
      return {
        winnerPoints: this.BASE_POINTS,
        loserPoints: -this.BASE_POINTS,
        winnerStreak: 0,
        loserStreak: 0
      };
    }
  }

  /**
   * NEW METHOD: Calculate and actually update user points in the backend
   */
  async calculateAndUpdatePoints(
    winnerId: string,
    loserId: string,
    isDraw: boolean = false
  ): Promise<PointsCalculation> {
    try {
      // First calculate the points
      const pointsCalc = await this.calculatePoints(winnerId, loserId, isDraw);

      console.log("[DEBUG] Points calculation:", pointsCalc);

      // Get current user data for both players
      const [winnerUser, loserUser] = await Promise.all([
        userService.getByUserId(winnerId),
        userService.getByUserId(loserId)
      ]);

      console.log("[DEBUG] Current points - Winner:", winnerUser.points, "Loser:", loserUser.points);

      // Calculate new point totals
      const newWinnerPoints = Math.max(0, (winnerUser.points || 0) + pointsCalc.winnerPoints);
      const newLoserPoints = Math.max(0, (loserUser.points || 0) + pointsCalc.loserPoints); // loserPoints is already negative

      console.log("[DEBUG] New points - Winner:", newWinnerPoints, "Loser:", newLoserPoints);

      // Update both users' points in parallel
      await Promise.all([
        userService.updateUser(winnerId, { points: newWinnerPoints }),
        userService.updateUser(loserId, { points: newLoserPoints })
      ]);

      console.log("[DEBUG] Points updated successfully in backend");

      return pointsCalc;

    } catch (error) {
      console.error("Error calculating and updating points:", error);
      // Still return the calculation even if update fails
      return await this.calculatePoints(winnerId, loserId, isDraw);
    }
  }

  /**
   * Calculate current win streak for a player
   */
  private calculateWinStreak(gameHistory: GameHistory[], playerId: string): number {
    // Sort by end time (most recent first)
    const sortedHistory = gameHistory
      .filter(game => game.result && game.endTime)
      .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime());

    let streak = 0;

    for (const game of sortedHistory) {
      if (!game.result) break;

      const isWinner = game.result.winnerid === playerId;
      const isDraw = game.result.winner === "draw";

      if (isWinner && !isDraw) {
        streak++;
      } else {
        break; // Streak broken
      }
    }

    return streak;
  }

  /**
   * Calculate current loss streak for a player
   */
  private calculateLossStreak(gameHistory: GameHistory[], playerId: string): number {
    // Sort by end time (most recent first)
    const sortedHistory = gameHistory
      .filter(game => game.result && game.endTime)
      .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime());

    let streak = 0;

    for (const game of sortedHistory) {
      if (!game.result) break;

      const isLoser = game.result.winnerid !== playerId && game.result.winner !== "draw";

      if (isLoser) {
        streak++;
      } else {
        break; // Streak broken
      }
    }

    return streak;
  }

  /**
   * Calculate points for winner based on win streak
   * Formula: Base points + (streak bonus capped at max)
   */
  private calculateWinnerPoints(winStreak: number): number {
    // Award more points for longer win streaks
    const streakBonus = Math.min(winStreak, this.MAX_POINTS - this.BASE_POINTS);
    return Math.min(this.BASE_POINTS + streakBonus, this.MAX_POINTS);
  }

  /**
   * Calculate points to deduct from loser based on loss streak
   * Formula: Base points + (streak penalty capped at max)
   */
  private calculateLoserPoints(lossStreak: number): number {
    // Deduct more points for longer loss streaks
    const streakPenalty = Math.min(lossStreak, this.MAX_POINTS - this.BASE_POINTS);
    return Math.min(this.BASE_POINTS + streakPenalty, this.MAX_POINTS);
  }

  /**
   * Get streak information for display purposes
   */
  async getPlayerStreakInfo(playerId: string): Promise<{
    winStreak: number;
    lossStreak: number;
    lastGameResult: 'win' | 'loss' | 'draw' | null;
  }> {
    try {
      const gameHistory = await gameHistoryService.getGameHistoriesByUser(playerId);

      if (gameHistory.length === 0) {
        return { winStreak: 0, lossStreak: 0, lastGameResult: null };
      }

      const winStreak = this.calculateWinStreak(gameHistory, playerId);
      const lossStreak = this.calculateLossStreak(gameHistory, playerId);

      // Get last game result
      const lastGame = gameHistory
        .filter(game => game.result && game.endTime)
        .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime())[0];

      let lastGameResult: 'win' | 'loss' | 'draw' | null = null;
      if (lastGame && lastGame.result) {
        if (lastGame.result.winner === "draw") {
          lastGameResult = 'draw';
        } else if (lastGame.result.winnerid === playerId) {
          lastGameResult = 'win';
        } else {
          lastGameResult = 'loss';
        }
      }

      return { winStreak, lossStreak, lastGameResult };
    } catch (error) {
      console.error("Error getting player streak info:", error);
      return { winStreak: 0, lossStreak: 0, lastGameResult: null };
    }
  }
}

export const pointsAttributionService = new PointsAttributionService();
