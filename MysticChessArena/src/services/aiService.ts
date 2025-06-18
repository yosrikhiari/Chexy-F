import { EnhancedRPGPiece } from '@/Interfaces/types/enhancedRpgChess';
import {BoardPosition, Piece, PieceColor, PieceType} from '@/Interfaces/types/chess';
import { AIStrategy } from '@/Interfaces/enums/AIStrategy';
import {RPGModifier, CapacityModifier} from '@/Interfaces/types/rpgChess';
import {calculateValidMoves, normalizeBoard, printBoard} from '@/utils/chessUtils.ts';
import {gameSessionService} from '@/services/GameSessionService.ts';
import {bots} from '@/Interfaces/Bot.ts';
import {gameService} from '@/services/GameService.ts';
import {chessGameService} from '@/services/ChessGameService.ts';

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


//////////////////////////


  async calculateValidMovesForColor(board: Piece[][], color: PieceColor, gameId: string) {
    console.log("Calculating moves for color:", color);
    console.log("Current board state:");
    printBoard(board); // Use the existing printBoard function

    const moves: { from: BoardPosition, to: BoardPosition }[] = [];

    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.color === color) {
          try {
            const possibleMoves = await calculateValidMoves(
              { row, col },
              board,
              color,
              gameId,
              "CLASSIC_SINGLE_PLAYER",
              8,
              true,
              null
            );
            possibleMoves.forEach(move => {
              moves.push({
                from: { row, col },
                to: move
              });
            });
          } catch (error) {
            console.error(`Error calculating moves for ${piece.type} at ${row},${col}:`, error);
          }
        }
      }
    }

    console.log(`Total valid moves found for ${color}:`, moves.length);
    return moves;
  }

  async getBotMove(gameId: string, color: PieceColor): Promise<{ from: BoardPosition, to: BoardPosition } | null> {
    try {
      console.log(`[Bot] Starting bot move calculation for ${color}`);
      const session = await gameSessionService.getGameSession(gameId);

      if (!session?.board) {
        console.error("[AI] Invalid game session - no board found");
        throw new Error("Invalid game session");
      }

      // Check game state first
      if (session.gameState.isCheckmate || session.gameState.isDraw) {
        console.log("[Bot] Game is already over");
        return null;
      }

      if (session.gameState.currentTurn !== color) {
        console.log(`[Bot] Not ${color}'s turn: ${session.gameState.currentTurn}`);
        return null;
      }

      console.log("[Bot] Current board state from server:");
      printBoard(session.board);

      const normalizedBoard = normalizeBoard(session.board);
      const validMoves = await this.calculateValidMovesForColor(normalizedBoard, color, gameId);

      if (validMoves.length === 0) {
        console.log("[Bot] No valid moves available - checking game state");

        // Check if this is checkmate or stalemate
        const isCheck = await chessGameService.isCheck(gameId, color);
        if (isCheck) {
          console.log("[Bot] Checkmate detected");
          await gameSessionService.endGame(gameId, color === "white" ? session.blackPlayer?.userId : session.whitePlayer.userId);
        } else {
          console.log("[Bot] Stalemate detected");
          await gameSessionService.endGame(gameId, undefined, true);
        }
        return null;
      }

      const capturingMoves = validMoves.filter(move => normalizedBoard[move.to.row][move.to.col] !== null);
      const move = capturingMoves.length > 0
        ? capturingMoves[Math.floor(Math.random() * capturingMoves.length)]
        : validMoves[Math.floor(Math.random() * validMoves.length)];

      console.log("[Bot] Selected move:", move);
      return move;
    } catch (error) {
      console.error("[AI] Error in getBotMove:", error);
      return null;
    }
  }

  private convertBoardToFEN(board: (Piece | null)[][], turn: 'w' | 'b'): string {
    let fen = '';
    for (let row = 0; row < 8; row++) {
      let empty = 0;
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (!piece) {
          empty++;
        } else {
          if (empty > 0) {
            fen += empty;
            empty = 0;
          }
          const pieceChar = this.pieceToChar(piece);
          fen += pieceChar;
        }
      }
      if (empty > 0) fen += empty;
      if (row < 7) fen += '/';
    }
    fen += ` ${turn} KQkq - 0 1`; // Simplified castling/en passant
    return fen;
  }

  private pieceToChar(piece: Piece): string {
    const map: Record<PieceType, string> = {
      king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p'
    };
    const c = map[piece.type] || '';
    return piece.color === 'white' ? c.toUpperCase() : c;
  }
}


export const aiserervice = new AIService();
