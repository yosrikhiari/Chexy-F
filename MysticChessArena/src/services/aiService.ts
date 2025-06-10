import { EnhancedRPGPiece, EnemyArmyConfig } from '@/Interfaces/types/enhancedRpgChess';
import { BoardPosition } from '@/Interfaces/types/chess';
import { AIStrategy } from '@/Interfaces/enums/AIStrategy';
import { RPGModifier, CapacityModifier } from '@/Interfaces/types/rpgChess';

export class AIService {
  private static baseUrl = 'http://localhost:5000/api';

  static async generateEnemyArmy(
    round: number,
    boardSize: number,
    activeModifiers: RPGModifier[] = [],
    activeCapacityModifiers: CapacityModifier[] = []
  ): Promise<EnhancedRPGPiece[]> {
    try {
      const response = await fetch(`${this.baseUrl}/enemy-army`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round, boardSize, activeModifiers, activeCapacityModifiers })
      });
      const data = await response.json();
      return data.pieces as EnhancedRPGPiece[];
    } catch (error) {
      console.error('Error generating enemy army:', error);
      throw new Error('Failed to generate enemy army');
    }
  }

  // Other methods remain unchanged
  static async getAIStrategy(round: number, playerArmySize: number): Promise<AIStrategy> {
    try {
      const response = await fetch(`${this.baseUrl}/ai-strategy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ round, playerArmySize })
      });
      const data = await response.json();
      return data.strategy as AIStrategy;
    } catch (error) {
      console.error('Error getting AI strategy:', error);
      throw new Error('Failed to get AI strategy');
    }
  }

  static async calculateAIMove(
    board: (EnhancedRPGPiece | null)[][],
    enemyPieces: EnhancedRPGPiece[],
    playerPieces: EnhancedRPGPiece[],
    strategy: AIStrategy,
    boardSize: number,
    round: number,
    gameId: string,
    gameMode: string,
    playerId?: string
  ): Promise<{ from: BoardPosition; to: BoardPosition } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/ai-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          board,
          enemyPieces,
          playerPieces,
          strategy,
          boardSize,
          round,
          gameId,
          gameMode,
          playerId
        })
      });
      const data = await response.json();
      return data.move ? {
        from: { row: data.from.row, col: data.from.col },
        to: { row: data.to.row, col: data.to.col }
      } : null;
    } catch (error) {
      console.error('Error calculating AI move:', error);
      throw new Error('Failed to calculate AI move');
    }
  }

  static async updateAI(
    round: number,
    playerArmySize: number,
    strategy: AIStrategy,
    reward: number,
    nextRound: number,
    nextPlayerArmySize: number
  ): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/update-ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          round,
          playerArmySize,
          strategy,
          reward,
          nextRound,
          nextPlayerArmySize
        })
      });
    } catch (error) {
      console.error('Error updating AI:', error);
      throw new Error('Failed to update AI');
    }
  }
}
