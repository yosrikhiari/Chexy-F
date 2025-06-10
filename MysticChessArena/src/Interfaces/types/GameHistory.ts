import {GameResult} from '@/Interfaces/types/chess.ts';

export interface GameHistory {
  id: string;
  gameSessionId: string;
  userIds: string[];
  startTime: string;
  endTime: string | null;
  result: GameResult | null;
  isRanked: boolean;
  isRPGMode: boolean;
  finalRound: number | null;
  finalScore: number | null;
}
