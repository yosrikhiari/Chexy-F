import {PieceColor, PieceType} from '@/Interfaces/types/chess.ts';

export interface PromotionModalProps {
  isOpen: boolean;
  color: PieceColor;
  onPromote: (pieceType: PieceType) => void;
}
