import { RPGGameState } from "@/Interfaces/types/rpgChess";
import { JwtService } from "./JwtService";

export class RPGGameService {
  baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:8081";

  private normalize(state: any) {
    if (!state) return state;
    state.gameid = state.gameid || state.gameId || state.game_id || state.id;
    state.gameId = state.gameId || state.gameid;
    if (!state.enemyArmy && state.enemyArmyConfig && Array.isArray(state.enemyArmyConfig.pieces)) {
      state.enemyArmy = state.enemyArmyConfig.pieces;
    }
    return state;
  }

  async createRPGGame(userId: string, gameSessionId: string, isMultiplayer: boolean = false): Promise<RPGGameState> {
    const response = await fetch(
      `${this.baseUrl}/rpg-game?userId=${userId}&gameSessionId=${gameSessionId}&isMultiplayer=${isMultiplayer}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${JwtService.getToken()}` },
      }
    );
    if (!response.ok) throw new Error("Failed to create RPG game");
    return this.normalize(await response.json());
  }

  async getRPGGame(gameId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/${gameId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get RPG game");
    return this.normalize(await response.json());
  }

  async getRPGGameBySession(gameSessionId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/session/${gameSessionId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get RPG game by session");
    return this.normalize(await response.json());
  }

  async progressToNextRound(gameId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/next-round/${gameId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to progress to next round");
    return this.normalize(await response.json());
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
    return this.normalize(await response.json());
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
    return this.normalize(await response.json());
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
    return this.normalize(await response.json());
  }

  async updateScore(gameId: string, scoreToAdd: number, playerId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/score/${gameId}?scoreToAdd=${scoreToAdd}&playerId=${playerId}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to update score");
    return this.normalize(await response.json());
  }

  async updateCoins(gameId: string, coinsToAdd: number, playerId: string): Promise<RPGGameState> {
    try {
      const response = await fetch(`${this.baseUrl}/rpg-game/coins/${gameId}?coinsToAdd=${coinsToAdd}&playerId=${playerId}`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${JwtService.getToken()}` },
      });

      if (!response.ok) {
        // Try to get detailed error message from response
        let errorMessage = "Failed to update coins";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
          console.error("Coin update error:", errorData);
        } catch (parseError) {
          console.error("Could not parse error response:", parseError);
        }

        // For 400 errors, provide more context
        if (response.status === 400) {
          console.error("Bad request details:", {
            gameId,
            coinsToAdd,
            playerId,
            status: response.status
          });
        }

        throw new Error(`${errorMessage} (Status: ${response.status})`);
      }

      return this.normalize(await response.json());
    } catch (error) {
      console.error("UpdateCoins failed:", error);
      throw error;
    }
  }
  async trackKill(gameId: string, killerPieceId: string, playerId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/kill/${gameId}/${killerPieceId}?playerId=${playerId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to track kill");
    return this.normalize(await response.json());
  }
  async activateAbility(gameId: string, pieceId: string, abilityId: string, targetPieceId?: string, playerId?: string): Promise<RPGGameState> {
    const params = new URLSearchParams({
      ability: abilityId,
      playerId: playerId || JwtService.getKeycloakId() || ''
    });

    if (targetPieceId) {
      params.append('targetPieceId', targetPieceId);
    }

    const response = await fetch(`${this.baseUrl}/rpg-game/ability/${gameId}/${pieceId}?${params}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to activate ability");
    }

    return this.normalize(await response.json());
  }

  async endRPGGame(gameId: string, victory: boolean): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/end/${gameId}?victory=${victory}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to end RPG game");
    return this.normalize(await response.json());
  }

  async getActiveRPGGamesByUser(userId: string): Promise<RPGGameState[]> {
    const response = await fetch(`${this.baseUrl}/rpg-game/active/${userId}`, {
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to get active RPG games");
    const list = await response.json();
    return Array.isArray(list) ? list.map((s: any) => this.normalize(s)) : [];
  }

  async purchaseShopItem(gameId: string, shopItemId: string, playerId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/purchase/${gameId}/${shopItemId}?playerId=${playerId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to purchase shop item");
    return this.normalize(await response.json());
  }

  // NEW: MVP client methods
  async chooseSpecialization(gameId: string, pieceId: string, specialization: string, playerId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/specialization/${gameId}/${pieceId}?specialization=${encodeURIComponent(specialization)}&playerId=${playerId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to choose specialization");
    return this.normalize(await response.json());
  }

  async equipItem(gameId: string, pieceId: string, item: any, playerId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/equip/${gameId}/${pieceId}?playerId=${playerId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${JwtService.getToken()}`,
      },
      body: JSON.stringify(item),
    });
    if (!response.ok) throw new Error("Failed to equip item");
    return this.normalize(await response.json());
  }

  async resolveTie(gameId: string, playerId: string, choice: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/resolve-tie/${gameId}?playerId=${playerId}&choice=${encodeURIComponent(choice)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to resolve tie");
    return this.normalize(await response.json());
  }

  async spawnQuests(gameId: string, playerId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/quests/spawn/${gameId}?playerId=${playerId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to spawn quests");
    return this.normalize(await response.json());
  }

  async acceptQuest(gameId: string, questId: string, playerId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/quests/accept/${gameId}/${questId}?playerId=${playerId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to accept quest");
    return this.normalize(await response.json());
  }

  async completeQuest(gameId: string, questId: string, playerId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/quests/complete/${gameId}/${questId}?playerId=${playerId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to complete quest");
    return this.normalize(await response.json());
  }

  async awardXp(gameId: string, pieceId: string, xp: number, playerId: string): Promise<RPGGameState> {
    const response = await fetch(`${this.baseUrl}/rpg-game/xp/${gameId}/${pieceId}?xp=${xp}&playerId=${playerId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${JwtService.getToken()}` },
    });
    if (!response.ok) throw new Error("Failed to award XP");
    return this.normalize(await response.json());
  }
}

export const rpgGameService = new RPGGameService();
