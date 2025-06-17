import { GameHistory } from "@/Interfaces/types/GameHistory";
import { GameResult } from "@/Interfaces/types/chess";
import { JwtService } from "./JwtService";

export class GameHistoryService {
  baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

  async createGameHistory(gameSessionId: string): Promise<GameHistory> {
    const response = await fetch(`${this.baseUrl}/game-history?gameSessionId=${gameSessionId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to create game history");
    return await response.json();
  }

  async completeGameHistory(historyId: string, result: {
    winner: string;
    winnerName: string;
    pointsAwarded: number;
    gameEndReason: string;
    gameid: any;
    winnerid: string
  }): Promise<GameHistory> {
    const response = await fetch(`${this.baseUrl}/game-history/complete/${historyId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify(result),
    });
    if (!response.ok) throw new Error("Failed to complete game history");
    return await response.json();
  }

  async getGameHistory(historyId: string): Promise<GameHistory> {
    const response = await fetch(`${this.baseUrl}/game-history/${historyId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get game history");
    return await response.json();
  }

  async getGameHistoriesByUser(userId: string): Promise<GameHistory[]> {
    const response = await fetch(`${this.baseUrl}/game-history/user/${userId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get game histories by user");
    return await response.json();
  }

  async getGameHistoriesBySession(gameSessionId: string): Promise<GameHistory> {
    const response = await fetch(`${this.baseUrl}/game-history/session/${gameSessionId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (response.status === 404) {
      throw new Error("Game history not found for this session");
    }
    if (!response.ok) throw new Error("Failed to get game histories by session");
    return await response.json();
  }

  async getRankedGamesByUser(userId: string): Promise<GameHistory[]> {
    const response = await fetch(`${this.baseUrl}/game-history/ranked/${userId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get ranked games");
    return await response.json();
  }

  async getRPGGamesHistoryByUser(userId: string): Promise<GameHistory[]> {
    const response = await fetch(`${this.baseUrl}/game-history/rpg/${userId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get RPG games");
    return await response.json();
  }

  async getRecentGames(since: string): Promise<GameHistory[]> {
    const response = await fetch(`${this.baseUrl}/game-history/recent?since=${since}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get recent games");
    return await response.json();
  }

  async addPlayerAction(historyId: string, playerActionId: string): Promise<GameHistory> {
    const response = await fetch(`${this.baseUrl}/game-history/action/${historyId}/${playerActionId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to add player action");
    return await response.json();
  }
}

export const gameHistoryService = new GameHistoryService();
