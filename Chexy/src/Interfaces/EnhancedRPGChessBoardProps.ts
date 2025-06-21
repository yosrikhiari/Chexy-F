import {EnhancedGameState} from '@/Interfaces/types/enhancedRpgChess.ts';

export interface EnhancedRPGChessBoardProps {
  gameState: EnhancedGameState;
  onBattleComplete: (victory: boolean) => void;
  onBackToPreparation: () => void;
}
