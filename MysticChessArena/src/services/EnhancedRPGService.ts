import { JwtService } from "./JwtService";

export class EnhancedRPGService {
  baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

  async resolveCombat(attacker: any, defender: any, gameId: string, playerId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/enhanced-rpg/combat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify({ attacker, defender, gameId, playerId }),
    });
    if (!response.ok) throw new Error("Failed to resolve combat");
    return await response.json();
  }

  async applyBoardEffect(gameId: string, effect: any, playerId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/enhanced-rpg/board-effect/${gameId}/${playerId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify(effect),
    });
    if (!response.ok) throw new Error("Failed to apply board effect");
  }

  async handleBossEncounter(gameId: string, boss: any, playerId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/enhanced-rpg/boss-encounter/${gameId}/${playerId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify(boss),
    });
    if (!response.ok) throw new Error("Failed to handle boss encounter");
  }
}

export const enhancedRPGService = new EnhancedRPGService();
