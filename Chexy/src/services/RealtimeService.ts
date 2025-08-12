import { JwtService } from "./JwtService";

import { API_BASE_URL } from "@/config/env";

export class RealtimeService {
  baseUrl = API_BASE_URL;

  async broadcastGameState(gameId: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}/realtime/broadcast/${gameId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to broadcast game state");
    const data = await response.json();
    return data.message;
  }

  async sendToPlayer(playerId: string, message: any): Promise<string> {
    const response = await fetch(`${this.baseUrl}/realtime/send/${playerId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify(message),
    });
    if (!response.ok) throw new Error("Failed to send message to player");
    const data = await response.json();
    return data.message;
  }
}

export const realtimeService = new RealtimeService();
