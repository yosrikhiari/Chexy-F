import {RPGGameState} from '@/Interfaces/types/rpgChess.ts';

export interface RPGChessBoardProps {
  gameState: RPGGameState;
  onBattleComplete: (victory: boolean) => void;
  onBackToPreparation: () => void;
}
