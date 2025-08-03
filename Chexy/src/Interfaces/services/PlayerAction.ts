import {PieceType} from '@/Interfaces/types/chess.ts';

export interface PlayerAction {
  gameId: string;
  playerId: string;
  actionType: 'move' | 'capture' | 'ability';
  from: [number, number];
  to: [number, number];
  timestamp: number;
  sequenceNumber: number;
}
