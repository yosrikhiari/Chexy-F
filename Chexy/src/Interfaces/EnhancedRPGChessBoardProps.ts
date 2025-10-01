import {EnhancedGameState} from '@/Interfaces/types/enhancedRpgChess.ts';

export interface EnhancedRPGChessBoardProps {
  gameState: EnhancedGameState;
  gameSessionId?: string;
  onBattleComplete: (victory: boolean) => void;
  onBackToPreparation: () => void;
}
