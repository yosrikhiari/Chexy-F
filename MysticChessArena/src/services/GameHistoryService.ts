import { GameHistory } from "@/Interfaces/types/GameHistory";
import { GameResult } from "@/Interfaces/types/chess";
import { JwtService } from "./JwtService";
import {PlayerAction} from '@/Interfaces/services/PlayerAction.ts';

export class GameHistoryService {
  baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

  async createGameHistory(gameSessionId: string): Promise<GameHistory> {
    if (!gameSessionId) throw new Error("gameSessionId is required");

    const response = await fetch(`${this.baseUrl}/game-history?gameSessionId=${gameSessionId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create history: ${error}`);
    }

    return await response.json();
  }

  // NEW: Ensure game history exists (get or create)
  async ensureGameHistory(gameSessionId: string): Promise<GameHistory> {
    if (!gameSessionId) throw new Error("gameSessionId is required");

    const response = await fetch(`${this.baseUrl}/game-history/ensure/${gameSessionId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to ensure history: ${error}`);
    }

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
    // Add validation before making the request
    if (!historyId || historyId === 'undefined' || historyId === 'null') {
      throw new Error(`Invalid historyId: ${historyId}. Cannot complete game history.`);
    }

    if (!result) {
      throw new Error("Game result is required");
    }

    console.log(`Completing game history with ID: ${historyId}`, result);

    const response = await fetch(`${this.baseUrl}/game-history/complete/${historyId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify(result),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to complete game history (${response.status}): ${errorText}`);
    }

    return await response.json();
  }

  async getGameHistory(historyId: string): Promise<GameHistory> {
    if (!historyId || historyId === 'undefined') {
      throw new Error("Invalid historyId provided");
    }

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
    if (!gameSessionId) throw new Error("gameSessionId is required");

    const response = await fetch(`${this.baseUrl}/game-history/session/${gameSessionId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });

    if (response.status === 404) {
      throw new Error("NOT_FOUND");
    }
    if (!response.ok) throw new Error(`Server error: ${response.status}`);

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
    if (!historyId || historyId === 'undefined') {
      throw new Error("Invalid historyId for adding player action");
    }

    const response = await fetch(`${this.baseUrl}/game-history/action/${historyId}/${playerActionId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to add player action");
    return await response.json();
  }

  async getPlayerActions(gameSessionId: string): Promise<PlayerAction[]> {
    const response = await fetch(`${this.baseUrl}/game-history/session/${gameSessionId}/actions`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to fetch player actions");
    return await response.json();
  }
}

export const gameHistoryService = new GameHistoryService();
