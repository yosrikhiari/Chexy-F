import { EnhancedRPGPiece } from '@/Interfaces/types/enhancedRpgChess';
import {BoardPosition, Piece, PieceColor, PieceType, ChessOpening} from '@/Interfaces/types/chess';
import { AIStrategy } from '@/Interfaces/enums/AIStrategy';
import {RPGModifier, CapacityModifier} from '@/Interfaces/types/rpgChess';
import {calculateValidMoves, normalizeBoard, printBoard} from '@/utils/chessUtils.ts';
import {gameSessionService} from '@/services/GameSessionService.ts';

import {chessGameService} from '@/services/ChessGameService.ts';
import {initialBoard} from '@/utils/chessConstants.ts';

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

  async getBotMove(gameId: string, color: PieceColor, botPoints: number = 600): Promise<{ from: BoardPosition; to: BoardPosition } | null> {
    try {
      console.log(`[Bot] Starting bot move calculation for ${color} (${botPoints} points)`);
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

      // Convert board to FEN for the AI service
      const fen = this.convertBoardToFEN(session.board, color === 'white' ? 'w' : 'b');

      // Call the AI service with botPoints
      const response = await fetch(`${AIService.baseUrl}/classic/ai-move`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fen,
          botPoints,
          gameId
        })
      });

      if (!response.ok) {
        throw new Error(`AI service returned ${response.status}`);
      }

      const data = await response.json();

      if (data.move) {
        return {
          from: { row: data.move.from.row, col: data.move.from.col },
          to: { row: data.move.to.row, col: data.move.to.col }
        };
      }

      // If no move returned, check if this is checkmate or stalemate
      const isCheck = await chessGameService.isCheck(gameId, color);
      if (isCheck) {
        console.log("[Bot] Checkmate detected");
        await gameSessionService.endGame(gameId, color === "white" ? session.blackPlayer?.userId : session.whitePlayer.userId);
      } else {
        console.log("[Bot] Stalemate detected");
        await gameSessionService.endGame(gameId, undefined, true);
      }

      return null;
    } catch (error) {
      console.error("[AI] Error in getBotMove:", error);
      return null;
    }
  }


  private convertBoardToFEN(board: any[][], turn: 'w' | 'b'): string {
    // Normalize the board to ensure it’s a valid 8x8 array of Piece | null
    const normalizedBoard: (Piece | null)[][] = this.normalizeBoard(board);

    let fen = '';
    for (let row = 0; row < 8; row++) {
      let empty = 0;
      for (let col = 0; col < 8; col++) {
        const piece = normalizedBoard[row][col];
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
    fen += ` ${turn} KQkq - 0 1`; // Simplified for now; adjust castling/en passant as needed
    console.log(`[DEBUG] Generated FEN: ${fen}`);
    return fen;
  }

  private normalizeBoard(board: any[][]): (Piece | null)[][] {
    if (!Array.isArray(board) || board.length !== 8 || !board.every(row => Array.isArray(row) && row.length === 8)) {
      console.warn('[AI] Invalid board structure, falling back to initial board');
      return initialBoard; // Import initialBoard from chessConstants.ts
    }

    return board.map((row, rowIndex) =>
      row.map((cell, colIndex) => {
        if (!cell) return null;
        // Assume backend sends { type: string, color: string, ... }
        if (typeof cell.type !== 'string' || typeof cell.color !== 'string') {
          console.warn(`[AI] Invalid piece at [${rowIndex},${colIndex}]:`, cell);
          return null;
        }
        const normalizedType = cell.type.toLowerCase() as PieceType;
        const normalizedColor = cell.color.toLowerCase() as PieceColor;
        if (!['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'].includes(normalizedType) ||
          !['white', 'black'].includes(normalizedColor)) {
          console.warn(`[AI] Unrecognized piece at [${rowIndex},${colIndex}]:`, cell);
          return null;
        }
        return { type: normalizedType, color: normalizedColor, hasMoved: cell.hasMoved ?? false };
      })
    );
  }

  private pieceToChar(piece: Piece): string {
    const map: Record<PieceType, string> = {
      king: 'k', queen: 'q', rook: 'r', bishop: 'b', knight: 'n', pawn: 'p'
    };
    const c = map[piece.type] || '';
    return piece.color === 'white' ? c.toUpperCase() : c;
  }


  async updateAndDetectOpening(gameId: string, moves: { from: BoardPosition; to: BoardPosition }[]): Promise<ChessOpening | null> {
    try {
      console.log("API call with moves:", moves); // Debug log
      const response = await fetch(`${AIService.baseUrl}/detect-opening`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ moves, gameId }),
      });

      if (!response.ok) {
        throw new Error(`Failed to detect opening: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("API response:", data); // Debug log
      return data.eco && data.name ? { eco: data.eco, name: data.name } : null;
    } catch (error) {
      console.error(`Error detecting opening for game ${gameId}:`, error);
      return null;
    }
  }
}


export const aiserervice = new AIService();
