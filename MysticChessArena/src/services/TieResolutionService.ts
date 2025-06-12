import { TieResolutionOption } from "@/Interfaces/TieResolutionOption";
import { JwtService } from "./JwtService";

export class TieResolutionService {
  baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

  async getAllOptions(): Promise<TieResolutionOption[]> {
    const response = await fetch(`${this.baseUrl}/tie-resolution/options`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get options");
    return await response.json();
  }
}

export const tieResolutionService = new TieResolutionService();
