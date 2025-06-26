import {Piece} from '@/Interfaces/types/chess.ts';
import {GameMode} from '@/Interfaces/enums/GameMode.ts';

export interface ChessSquareProps {
  row: number;
  col: number;
  piece: Piece | null;
  isLight: boolean;
  isSelected: boolean;
  isValidMove: boolean;
  isCheck?: boolean;
  actualRowIndex: number;
  actualColIndex: number;
  onClick: (row: number, col: number) => void;
  specialEffect?: string; // Maps to BoardEffect.type
  gameId?: string; // For backend calls
  playerId?: string; // For backend calls
  gameMode?: GameMode; // To determine service usage
  onError?: (error: string) => void; // To propagate errors to parent
  onPieceClick?: (piece: Piece, position: { row: number; col: number }) => void;
}
