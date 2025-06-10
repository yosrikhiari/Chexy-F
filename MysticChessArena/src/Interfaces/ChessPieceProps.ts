import { Piece } from '@/Interfaces/types/chess.ts';
import { RPGPiece } from '@/Interfaces/types/rpgChess.ts';
import { EnhancedRPGPiece } from '@/Interfaces/types/enhancedRpgChess.ts';

export interface ChessPieceProps {
  piece: Piece | RPGPiece | EnhancedRPGPiece;
  gameMode?: 'CLASSIC_MULTIPLAYER' | 'SINGLE_PLAYER_RPG' | 'MULTIPLAYER_RPG' | 'ENHANCED_RPG' | 'TOURNAMENT';
  onClick?: (piece: Piece | RPGPiece | EnhancedRPGPiece) => void; // Optional click handler for piece interaction
  isSelected?: boolean; // Indicate if the piece is selected
  gameId?: string; // Added for backend calls
  playerId?: string; // Added for backend calls
}
