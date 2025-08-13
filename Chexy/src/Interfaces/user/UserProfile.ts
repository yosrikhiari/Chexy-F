// src/app/models/user-profile.model.ts
export interface UserProfile {
  id: string;
  userId: string;
  ownedPieceIds?: string[];
  ownedModifierIds?: string[];
  totalCoins?: number;
  highestScore?: number;
  gamesPlayed?: number;
  gamesWon?: number;
  createdAt?: string;
  lastUpdated?: string;
  currentGameSessionId?: string;
  gameHistoryIds?: string[];
}
