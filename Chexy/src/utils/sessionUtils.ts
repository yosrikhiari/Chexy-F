import { GameSession } from "@/Interfaces/types/GameSession";
import { PlayerSessionInfo } from "@/Interfaces/types/PlayerSessionInfo";

export const normalizePlayer = (
  playerData: PlayerSessionInfo | PlayerSessionInfo[] | null | undefined
): PlayerSessionInfo | null => {
  if (!playerData) return null;
  if (Array.isArray(playerData)) {
    return playerData.length > 0 ? playerData[0] : null;
  }
  if (typeof playerData === "object") {
    return playerData;
  }
  return null;
};

export const getWhitePlayer = (session: GameSession): PlayerSessionInfo | null =>
  normalizePlayer(session.whitePlayer as any);

export const getBlackPlayer = (session: GameSession): PlayerSessionInfo | null =>
  normalizePlayer((session as any).blackPlayer);


