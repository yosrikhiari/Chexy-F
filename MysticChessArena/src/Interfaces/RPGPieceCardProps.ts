import {RPGPiece} from '@/Interfaces/types/rpgChess.ts';
import {GameMode} from '@/Interfaces/enums/GameMode.ts';

export interface RPGPieceCardProps {
  piece: RPGPiece;
  onClick?: () => void;
  gameId?: string;
  playerId?: string;
  gameMode?: GameMode; // To determine service usage
  onError?: (error: string) => void; // Propagate errors to parent
  onPieceUpdate?: (piece: RPGPiece) => void; // Notify parent of piece changes
}
