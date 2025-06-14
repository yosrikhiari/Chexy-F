import { EnhancedRPGPiece, EnemyArmyConfig } from '@/Interfaces/types/enhancedRpgChess';
import {BoardPosition, Piece, PieceColor, PieceType} from '@/Interfaces/types/chess';
import { AIStrategy } from '@/Interfaces/enums/AIStrategy';
import {RPGModifier, CapacityModifier, RPGPiece} from '@/Interfaces/types/rpgChess';
import {calculateValidMoves} from '@/utils/chessUtils.ts';
import {gameSessionService} from '@/services/GameSessionService.ts';
import {UserService} from '@/services/UserService.ts';

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





  async calculateValidMovesForColor(board: Piece[][], color: PieceColor, gameId: string) {
    const moves: { from: BoardPosition, to: BoardPosition }[] = [];

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === color) {
          try {
            const validMoves = await calculateValidMoves(
              { row, col },
              board,
              color,
              gameId,
              "CLASSIC_SINGLE_PLAYER",
              8,
              true,
              null
            );

            validMoves.forEach(move => {
              moves.push({
                from: { row, col },
                to: move
              });
            });
          } catch (error) {
            console.error(`Error calculating moves for piece at ${row},${col}:`, error);
          }
        }
      }
    }

    return moves;
  }


  async getBotMove(gameId: string, color: PieceColor): Promise<{ from: BoardPosition, to: BoardPosition } | null> {
    try {
      const session = await gameSessionService.getGameSession(gameId);
      if (!session || !session.board) {
        throw new Error("Invalid game session or missing board");
      }

      console.log(`Calculating moves for ${color} at turn ${session.gameState?.currentTurn}`);

      // Ensure board is properly typed
      const board = session.board as Piece[][];
      const validMoves = await this.calculateValidMovesForColor(board, color, gameId);

      console.log(`Found ${validMoves.length} valid moves for bot`);
      if (validMoves.length === 0) {
        console.log("No valid moves available for bot");
        return null;
      }

      // Prioritize moves
      const prioritizedMoves = this.prioritizeMoves(board, validMoves, color);
      const selectedMove = prioritizedMoves[0];

      console.log("Bot selected move:", selectedMove);
      return selectedMove;
    } catch (error) {
      console.error("Failed to get bot move:", error);
      throw error;
    }
  }

  private prioritizeMoves(board: Piece[][], moves: { from: BoardPosition, to: BoardPosition }[], color: PieceColor) {
    const pieceValues: Record<PieceType, number> = {
      queen: 9,
      rook: 5,
      bishop: 3,
      knight: 3,
      pawn: 1,
      king: 0 // Don't prioritize capturing king (handled separately)
    };

    return moves.sort((a, b) => {
      const targetA = board[a.to.row][a.to.col];
      const targetB = board[b.to.row][b.to.col];

      // 1. Checkmate moves first
      if (targetA?.type === 'king') return -1;
      if (targetB?.type === 'king') return 1;

      // 2. Capture high-value pieces
      const valueA = targetA ? pieceValues[targetA.type] || 0 : 0;
      const valueB = targetB ? pieceValues[targetB.type] || 0 : 0;

      if (valueA !== valueB) return valueB - valueA;

      // 3. Prefer center control
      const centerScoreA = this.getCenterScore(a.to);
      const centerScoreB = this.getCenterScore(b.to);

      return centerScoreB - centerScoreA;
    });
  }
  private getCenterScore(pos: BoardPosition): number {
    // Center is more valuable (scores based on distance from center)
    const centerX = 3.5, centerY = 3.5;
    const dx = Math.abs(pos.col - centerX);
    const dy = Math.abs(pos.row - centerY);
    return 1 - (dx + dy) / 7; // Normalized score 0-1
  }
}


export const aiserervice = new AIService();
