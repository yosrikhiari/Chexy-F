import {PlayerNames} from '@/Interfaces/PlayerNames.ts';
import {GameResult, GameState, PieceColor} from '@/Interfaces/types/chess.ts';

export interface GameControlsProps {
  onReset?: () => void;
  onFlipBoard?: () => void;
  onChangePlayerNames?: (names: { player1: string; player2: string }) => void;
  onResign?: (customResult?: GameResult) => void; // Modified to accept optional custom result
  gameState: GameState;
  currentPlayer: PieceColor;
  onBackToLobby?: () => void;
}
