import {GameMode} from '@/Interfaces/enums/GameMode.ts';

export interface GameType {
  title: string;
  description: string;
  icon: JSX.Element;
  comingSoon: boolean;
  path: string;
  isRanked: boolean;
  mode: GameMode;
}
