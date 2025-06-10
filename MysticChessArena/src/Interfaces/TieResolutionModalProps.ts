import {TieResolutionOption} from '@/Interfaces/TieResolutionOption.ts';

export interface TieResolutionModalProps {
  isOpen: boolean;
  onResolve: (option: TieResolutionOption) => void;
  onClose: () => void;
  gameId?: string;
}
