import { GameStateData } from "@/Interfaces/services/GameStateData";
import { JwtService } from "./JwtService";

import { API_BASE_URL } from "@/config/env";

export class GameService {
  baseUrl = API_BASE_URL;

  async executeMove(gameId: string, move: {
    from: { row: number; col: number };
    to: { row: number; col: number }
  }): Promise<GameStateData> {
    // Convert to backend format - your backend expects row, col, torow, tocol
    const backendMove = {
      row: move.from.row,
      col: move.from.col,
      torow: move.to.row,
      tocol: move.to.col
    };

    // Add validation
    if (!this.isValidCoordinate(backendMove.row, backendMove.col) ||
      !this.isValidCoordinate(backendMove.torow, backendMove.tocol)) {
      throw new Error("Invalid move coordinates");
    }

    try {
      console.log("[DEBUG] Sending HTTP move request:", { gameId, backendMove });

      const response = await fetch(`${this.baseUrl}/games/${gameId}/moves`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${JwtService.getToken()}`,
        },
        body: JSON.stringify(backendMove),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: Failed to execute move`);
      }

      const result = await response.json();
      console.log("[DEBUG] HTTP move response:", result);
      return result;
    } catch (error) {
      console.error("Move execution failed:", error);
      throw error;
    }
  }

  private isValidCoordinate(row: number, col: number): boolean {
    return row >= 0 && row < 8 && col >= 0 && col < 8;
  }

}

export const gameService = new GameService();
