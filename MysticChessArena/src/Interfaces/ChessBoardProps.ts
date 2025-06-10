import {GameState, GameTimers, PieceColor} from '@/Interfaces/types/chess.ts';
import React from 'react';

export interface ChessBoardProps {
  flipped?: boolean;
  onPlayerChange?: (player: PieceColor) => void;
  timers?: GameTimers;
  onTimeUpdate?: (timers: GameTimers) => void;
  onTimeout?: (color: PieceColor) => void;
  player1Name?: string;
  player2Name?: string;
  onResetGame?: () => void;
  currentPlayer?: PieceColor;
  onMove?: (color: PieceColor) => void;
  gameState?: GameState;
  onGameStateChange?: React.Dispatch<React.SetStateAction<GameState>>;
}
