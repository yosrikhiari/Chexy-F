import { JwtService } from "./JwtService";
import {Piece} from '@/Interfaces/types/chess.ts';
import {RPGPiece} from '@/Interfaces/types/rpgChess.ts';

export class ChessGameService {
  baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

  async validateMove(gameId: string, move: { from: { row: number; col: number }; to: { row: number; col: number } }): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/games/chess/${gameId}/validate-move`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify(move),
    });
    if (!response.ok) throw new Error("Failed to validate move");
    return await response.json();
  }

  async isCheck(gameId: string, color: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/games/chess/${gameId}/check-status?color=${color}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to check status");
    return await response.json();
  }

  async isCheckmate(gameId: string, color: string): Promise<boolean> {
    const response = await fetch(`${this.baseUrl}/api/games/chess/${gameId}/checkmate-status?color=${color}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to check checkmate");
    return await response.json();
  }
}

export const chessGameService = new ChessGameService();
