import {GameResult} from '@/Interfaces/types/chess.ts';

export interface GameEndModalProps {
  open: boolean;
  gameResult: GameResult | null;
  onClose: () => void;
  onPlayAgain: () => void;
  isRankedMatch?: boolean;
  totalPoints?: number; // New prop
  forcedPointsDelta?: number; // Forces the modal to display this delta if provided
}
