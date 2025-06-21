import { Piece, GameState, GameTimers } from "./chess";
import { PlayerSessionInfo } from "./PlayerSessionInfo";
import {GameStatus} from '@/Interfaces/enums/GameStatus.ts';
import {EnhancedRPGPiece} from '@/Interfaces/types/enhancedRpgChess.ts';
import {RPGPiece} from '@/Interfaces/types/rpgChess.ts';
import {GameMode} from '@/Interfaces/enums/GameMode.ts';


export interface GameSession {
  gameId: string;
  whitePlayer: PlayerSessionInfo;
  blackPlayer: PlayerSessionInfo;
  gameMode?: GameMode;
  isRankedMatch: boolean;
  isPrivate: boolean;
  inviteCode: string;

  board?: Piece[][] | EnhancedRPGPiece[][] | RPGPiece[][];

  gameState: GameState;
  rpgGameStateId: string;
  enhancedGameStateId: string;

  timers: GameTimers;
  createdAt: string;
  startedAt: string;
  lastActivity: string;
  isActive: boolean;
  status: GameStatus;
  playerLastSeen: Record<string, string>;
  timeControlMinutes: number;
  incrementSeconds: number;
  allowSpectators: boolean;
  spectatorIds: string[];
  gameHistoryId: string;
  moveHistoryIds: string[];
}
