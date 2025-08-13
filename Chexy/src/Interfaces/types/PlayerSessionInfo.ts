import { PlayerStats } from "./chess";

export interface PlayerSessionInfo {
  id: string;
  userId: string;
  keycloakId: string;
  username: string;
  displayName: string;
  sessionId: string;
  isConnected: boolean;
  lastSeen: string;
  currentStats: PlayerStats;
  currentTurn?: boolean;
}
