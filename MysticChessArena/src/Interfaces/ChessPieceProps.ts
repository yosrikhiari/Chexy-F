import { Piece } from '@/Interfaces/types/chess.ts';
import { RPGPiece } from '@/Interfaces/types/rpgChess.ts';
import { EnhancedRPGPiece } from '@/Interfaces/types/enhancedRpgChess.ts';

export interface ChessPieceProps {
  piece: Piece | RPGPiece | EnhancedRPGPiece | null;
  gameMode?: 'CLASSIC_MULTIPLAYER' | 'CLASSIC_SINGLE_PLAYER' | 'SINGLE_PLAYER_RPG' | 'MULTIPLAYER_RPG' | 'ENHANCED_RPG' | 'TOURNAMENT';
  onClick?: (piece: Piece | RPGPiece | EnhancedRPGPiece, position: { row: number; col: number }) => void;
  isSelected?: boolean;
  gameId?: string;
  playerId?: string;
}
