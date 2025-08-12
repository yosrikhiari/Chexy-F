import { JwtService } from "./JwtService";
import { Move, PieceColor} from '@/Interfaces/types/chess.ts';


import { API_BASE_URL } from "@/config/env";

export class ChessGameService {
  baseUrl = API_BASE_URL;

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
      const lowercaseColor = color.toLowerCase();
      const response = await fetch(`${this.baseUrl}/api/games/chess/${gameId}/checkmate-status?color=${lowercaseColor}`, {
        headers: { Authorization: `Bearer ${JwtService.getToken()}` },
      });
      if (!response.ok) throw new Error("Failed to check checkmate");
      return await response.json();
    } catch (error) {
      console.error(`Error in isCheckmate: gameId=${gameId}, color=${color}`, error);
      throw error;
    }
  }
  async isDraw(gameId: string, color: PieceColor): Promise<boolean> {
    try {
      const lowercaseColor = color.toLowerCase();
      const response = await fetch(`${this.baseUrl}/api/games/chess/${gameId}/draw-status?color=${lowercaseColor}`, {
        headers: { Authorization: `Bearer ${JwtService.getToken()}` },
      });
      if (!response.ok) throw new Error("Failed to check draw status");
      return await response.json();
    } catch (error) {
      console.error(`Error in isDraw: gameId=${gameId}, color=${color}`, error);
      throw error;
    }
  }



}

export const chessGameService = new ChessGameService();
