import { JwtService } from "./JwtService";
import {RPGGameState} from '@/Interfaces/types/rpgChess.ts';

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



  async activateAbility(gameId: string, pieceId: string, ability: string, targetPieceId: string | null, playerId: string): Promise<any> {
    const params = new URLSearchParams({
      ability: ability,
      playerId: playerId
    });

    if (targetPieceId) {
      params.append('targetPieceId', targetPieceId);
    }

    const response = await fetch(`${this.baseUrl}/rpg-game/ability/${gameId}/${pieceId}?${params}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to activate ability");
    }

    return await response.json();
  }
}

export const enhancedRPGService = new EnhancedRPGService();
