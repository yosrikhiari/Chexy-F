import { GameStateData } from "@/Interfaces/services/GameStateData";
import { JwtService } from "./JwtService";

export class GameService {
  baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

  async executeMove(gameId: string, move: {
    from: { row: number; col: number };
    to: { row: number; col: number }
  }): Promise<GameStateData> {
    const backendMove = {
      row: move.from.row,
      col: move.from.col,
      torow: move.to.row,
      tocol: move.to.col
    };

    const response = await fetch(`${this.baseUrl}/games/${gameId}/moves`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify(backendMove),
    });
    if (!response.ok) throw new Error("Failed to execute move");
    return await response.json();
  }
}

export const gameService = new GameService();
