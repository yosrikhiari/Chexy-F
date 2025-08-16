import { GameMode } from "@/Interfaces/enums/GameMode";

export interface GameInvite {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  gameMode: GameMode;
  isRanked: boolean;
  gameType: string;
  timestamp: number;
}

export interface GameInviteResponse {
  id: string;
  fromUserId: string;
  fromUsername: string;
  toUserId: string;
  gameMode: GameMode;
  isRanked: boolean;
  gameType: string;
  timestamp: number;
  status: 'pending' | 'accepted' | 'declined';
}

class GameInviteService {
  private static instance: GameInviteService;

  public static getInstance(): GameInviteService {
    if (!GameInviteService.instance) {
      GameInviteService.instance = new GameInviteService();
    }
    return GameInviteService.instance;
  }

  public sendGameInvite(
    stompClient: any,
    fromUserId: string,
    fromUsername: string,
    toUserId: string,
    gameMode: GameMode,
    isRanked: boolean,
    gameType: string,
    inviteId?: string
  ): string {
    if (!stompClient) {
      console.error("WebSocket client not available");
      return "";
    }

    const invite: GameInvite = {
      id: inviteId || `invite_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      fromUserId,
      fromUsername,
      toUserId,
      gameMode,
      isRanked,
      gameType,
      timestamp: Date.now(),
    };

    stompClient.publish({
      destination: "/app/game-invite/send",
      body: JSON.stringify(invite),
    });

    return invite.id;
  }

  public acceptGameInvite(
    stompClient: any, 
    inviteId: string, 
    userId: string, 
    fromUserId: string,
    fromUsername: string,
    gameMode: GameMode,
    isRanked: boolean,
    gameType: string
  ): void {
    if (!stompClient) {
      console.error("WebSocket client not available");
      return;
    }

    stompClient.publish({
      destination: "/app/game-invite/accept",
      body: JSON.stringify({
        inviteId,
        userId,
        fromUserId,
        fromUsername,
        gameMode,
        isRanked,
        gameType,
      }),
    });
  }

  public declineGameInvite(stompClient: any, inviteId: string, userId: string): void {
    if (!stompClient) {
      console.error("WebSocket client not available");
      return;
    }

    stompClient.publish({
      destination: "/app/game-invite/decline",
      body: JSON.stringify({
        inviteId,
        userId,
      }),
    });
  }
}

export const gameInviteService = GameInviteService.getInstance();
