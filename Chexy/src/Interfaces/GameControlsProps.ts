import {PlayerNames} from '@/Interfaces/PlayerNames.ts';
import {GameState, PieceColor} from '@/Interfaces/types/chess.ts';

export interface GameControlsProps {
  onReset: () => void;
  onFlipBoard?: () => void;
  onChangePlayerNames?: (names: PlayerNames) => void;
  onResign?: () => void;
  gameState?: GameState;
  currentPlayer?: PieceColor;
}
