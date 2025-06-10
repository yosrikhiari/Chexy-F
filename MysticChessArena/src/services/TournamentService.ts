import { JwtService } from "./JwtService";

export class TournamentService {
  baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8080";

  async createTournament(tournament: any): Promise<any> {
    const response = await fetch(`${this.baseUrl}/tournament`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify(tournament),
    });
    if (!response.ok) throw new Error("Failed to create tournament");
    return await response.json();
  }

  async generateBracket(tournamentId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/tournament/bracket/${tournamentId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to generate bracket");
  }

  async scheduleMatches(tournamentId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/tournament/schedule/${tournamentId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to schedule matches");
  }
}

export const tournamentService = new TournamentService();
