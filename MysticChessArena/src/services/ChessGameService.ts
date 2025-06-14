import { JwtService } from "./JwtService";
import {BoardPosition, Move, Piece, PieceColor} from '@/Interfaces/types/chess.ts';
import {RPGPiece} from '@/Interfaces/types/rpgChess.ts';
import {gameSessionService} from '@/services/GameSessionService.ts';
import {calculateValidMoves} from '@/utils/chessUtils.ts';
import {EnhancedRPGPiece} from '@/Interfaces/types/enhancedRpgChess.ts';

export class ChessGameService {
  baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

  async validateMove(gameId: string, move: Move): Promise<boolean> {
    if (!gameId) {
      console.error("Game ID is required");
      return false;
    }

    try {
      const response = await fetch(`${this.baseUrl}/api/games/chess/${gameId}/validate-move`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JwtService.getToken()}`,
        },
        body: JSON.stringify(move),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("Failed to validate move:", error);
      return false;
    }
  }

  async isCheck(gameId: string, color: PieceColor): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/api/games/chess/${gameId}/check-status?color=${color}`, {
        headers: { Authorization: `Bearer ${JwtService.getToken()}` },
      });
      if (!response.ok) throw new Error("Failed to check status");
      return await response.json();
    } catch (error) {
      console.error(`Error in isCheck: gameId=${gameId}, color=${color}`, error);
      throw error;
    }
  }


  async isCheckmate(gameId: string, color: PieceColor): Promise<boolean> {
    try {
      // Convert color to lowercase before sending
      const lowercaseColor = color.toLowerCase();
      const response = await fetch(`${this.baseUrl}/games/chess/${gameId}/checkmate?color=${lowercaseColor}`, {
        headers: { Authorization: `Bearer ${JwtService.getToken()}` },
      });
      if (!response.ok) throw new Error("Failed to check checkmate");
      return await response.json();
    } catch (error) {
      console.error(`Error in isCheckmate: gameId=${gameId}, color=${color}`, error);
      throw error;
    }
  }
}

export const chessGameService = new ChessGameService();
