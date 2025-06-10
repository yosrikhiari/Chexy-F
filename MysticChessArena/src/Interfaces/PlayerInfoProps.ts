import {PieceColor, PieceType} from '@/Interfaces/types/chess.ts';

interface PromotionModalProps {
  isOpen: boolean;
  color: PieceColor;
  onPromote: (pieceType: PieceType) => void;
}

export interface PlayerInfoProps {
  name?: string; // Optional, with fallback to backend data
  points?: number; // Optional, with fallback to backend data
  color: PieceColor | string; // Required, aligns with PieceColor
  isCurrentPlayer?: boolean; // Optional, with fallback to game state
  className?: string;
  player1Name?: string; // Backward compatibility
  player2Name?: string; // Backward compatibility
  currentPlayer?: PieceColor; // Backward compatibility
  userId?: string; // To fetch user data
  gameId?: string; // To fetch game session data
}
