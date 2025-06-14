import {GameMode} from '@/Interfaces/enums/GameMode.ts';

export interface ChessGameLayoutProps {
  className?: string;
  isRankedMatch?: boolean;
  gameId?: string;
  playerId?: string;
  mode: GameMode
}
