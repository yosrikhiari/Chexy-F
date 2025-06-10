import {RPGGameState} from '@/Interfaces/types/rpgChess.ts';

export interface RPGBattleBoardProps {
  gameState: RPGGameState;
  objective: { type: string; description: string };
  onBattleComplete: (victory: boolean) => void;
}
