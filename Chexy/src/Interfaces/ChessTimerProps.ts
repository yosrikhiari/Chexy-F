import {GameTimers, PieceColor, PlayerTimer} from '@/Interfaces/types/chess.ts';
import React from 'react';

export interface ChessTimerProps {
  timers: GameTimers;
  setTimers: React.Dispatch<React.SetStateAction<GameTimers>>;
  currentPlayer: PieceColor;
  isGameOver: boolean;
  onTimeout: (color: PieceColor) => void;
  timer?: PlayerTimer;
  color?: PieceColor;
  playerName?: string;
  gameId?: string; // For backend calls
  playerId?: string; // For backend calls
  onError?: (error: string) => void; // To propagate errors to parent
}
