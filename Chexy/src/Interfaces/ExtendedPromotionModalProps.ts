import {PromotionModalProps} from '@/Interfaces/PromotionModalProps.ts';
import {BoardPosition, PieceColor, PieceType} from '@/Interfaces/types/chess.ts';

export interface ExtendedPromotionModalProps extends PromotionModalProps {
  isOpen: boolean;
  color: PieceColor;
  onPromote: (pieceType: PieceType) => Promise<void>;
  gameId?: string;
  from?: BoardPosition;
  to?: BoardPosition;
}
