import { GameSession } from "@/Interfaces/types/GameSession";
import { JwtService } from "./JwtService";
import {GameState} from '@/Interfaces/types/chess.ts';

export class GameSessionService {
  baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

  async createGameSession(playerId: string, gameMode: string, isPrivate: boolean = false, inviteCode?: string, botId?: string): Promise<GameSession> {
    let url = `${this.baseUrl}/game-session?playerId=${playerId}&gameMode=${gameMode}&isPrivate=${isPrivate}`;
    if (inviteCode) url += `&inviteCode=${inviteCode}`;
    if (botId) url += `&botId=${botId}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to create game session");
    return await response.json();
  }

  async getGameSession(gameId: string): Promise<GameSession> {
    const response = await fetch(`${this.baseUrl}/game-session/${gameId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get game session");
    return await response.json();
  }

  async getGameSessionByGameStateId(gameId: string): Promise<GameSession> {
    const response = await fetch(`${this.baseUrl}/FindByGS/${gameId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get game session");
    return await response.json();
  }

  async joinGame(gameId: string, playerId: string, inviteCode?: string): Promise<GameSession> {
    const response = await fetch(
      `${this.baseUrl}/game-session/join/${gameId}?playerId=${playerId}${inviteCode ? `&inviteCode=${inviteCode}` : ""}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${JwtService.getToken()}` },
      }
    );
    if (!response.ok) throw new Error("Failed to join game");
    return await response.json();
  }

  async startGame(gameId: string): Promise<GameSession> {
    const response = await fetch(`${this.baseUrl}/game-session/start/${gameId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) {
      const errorText = await response.text(); // Log the full response
      console.error("Start game failed:", response.status, errorText);
      throw new Error(`Failed to start game: ${errorText}`);
    }
    return await response.json();
  }
  async endGame(gameId: string, winnerId?: string, isDraw: boolean = false, tieOption?: string): Promise<GameSession> {
    let url = `${this.baseUrl}/game-session/end/${gameId}`;
    const params = new URLSearchParams();
    if (winnerId) params.append("winnerId", winnerId);
    if (isDraw) params.append("isDraw", "true");
    if (tieOption) params.append("tieOption", tieOption);
    url += `?${params.toString()}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });


    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to end game: ${response.status} - ${errorText}`);
    }
    return await response.json();
  }

  async getActiveGamesForPlayer(playerId: string): Promise<GameSession[]> {
    const response = await fetch(`${this.baseUrl}/game-session/active/${playerId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get active games");
    return await response.json();
  }

  async getAvailableGames(): Promise<GameSession[]> {
    const response = await fetch(`${this.baseUrl}/game-session/available`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get available games");
    return await response.json();
  }

  async updateGameStatus(gameId: string, status: string): Promise<GameSession> {
    const response = await fetch(`${this.baseUrl}/game-session/status/${gameId}?status=${status}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to update game status");
    return await response.json();
  }

  async getGamesByMode(gameMode: string): Promise<GameSession[]> {
    const response = await fetch(`${this.baseUrl}/game-session/mode/${gameMode}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get games by mode");
    return await response.json();
  }

  async joinSpectate(gameId: string, playerId:string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/game-session/${gameId}/Spectate/join/${playerId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to join games");
    return await response.json();
  }
  async leaveSpectate(gameId: string, playerId:string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/game-session/${gameId}/Spectate/leave/${playerId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to join games");
    return await response.json();
  }
  async getSpectators(gameId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/game-session/${gameId}/Spectators`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to join games");
    return await response.json();
  }


}

export const gameSessionService = new GameSessionService();
