import { RPGGameState } from "@/Interfaces/types/rpgChess";
import { JwtService } from "./JwtService";

export class RPGGameService {
  baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

  async createRPGGame(userId: string, gameSessionId: string, isMultiplayer: boolean = false): Promise<RPGGameState> {
    const response = await fetch(
      `${this.baseUrl}/rpg-game?userId=${userId}&gameSessionId=${gameSessionId}&isMultiplayer=${isMultiplayer}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${JwtService.getToken()}` },
      }
    );
    if (!response.ok) throw new Error("Failed to create RPG game");
    return await response.json();
  }

  async getRPGGame(gameId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/${gameId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get RPG game");
    return await response.json();
  }

  async getRPGGameBySession(gameSessionId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/session/${gameSessionId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get RPG game by session");
    return await response.json();
  }

  async progressToNextRound(gameId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/next-round/${gameId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to progress to next round");
    return await response.json();
  }

  async addPieceToArmy(gameId: string, piece: any, playerId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/add-piece/${gameId}?playerId=${playerId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify(piece),
    });
    if (!response.ok) throw new Error("Failed to add piece");
    return await response.json();
  }

  async addModifier(gameId: string, modifier: any, playerId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/add-modifier/${gameId}?playerId=${playerId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify(modifier),
    });
    if (!response.ok) throw new Error("Failed to add modifier");
    return await response.json();
  }

  async addBoardEffect(gameId: string, effect: any, playerId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/add-board-effect/${gameId}?playerId=${playerId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify(effect),
    });
    if (!response.ok) throw new Error("Failed to add board effect");
    return await response.json();
  }

  async updateScore(gameId: string, scoreToAdd: number, playerId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/score/${gameId}?scoreToAdd=${scoreToAdd}&playerId=${playerId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to update score");
    return await response.json();
  }

  async updateCoins(gameId: string, coinsToAdd: number, playerId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/coins/${gameId}?coinsToAdd=${coinsToAdd}&playerId=${playerId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to update coins");
    return await response.json();
  }

  async endRPGGame(gameId: string, victory: boolean): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/end/${gameId}?victory=${victory}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to end RPG game");
    return await response.json();
  }

  async getActiveRPGGamesByUser(userId: string): Promise<RPGGameState[]> {
    const response = await fetch(`${this.baseUrl}/rpg-game/active/${userId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get active RPG games");
    return await response.json();
  }

  async purchaseShopItem(gameId: string, shopItemId: string, playerId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/purchase/${gameId}/${shopItemId}?playerId=${playerId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to purchase shop item");
    return await response.json();
  }
}

export const rpgGameService = new RPGGameService();
