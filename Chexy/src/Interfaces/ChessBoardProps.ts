import {
  BoardPosition,
  GameResult,
  GameState,
  GameTimers,
  Piece,
  PieceColor,
  PieceType
} from '@/Interfaces/types/chess.ts';
import React from 'react';

export interface ChessBoardProps {
  flipped?: boolean;
  onPlayerChange?: (player: PieceColor) => void;
  timers?: GameTimers;
  onTimeUpdate?: (timers: GameTimers) => void;
  player1Name?: string;
  player2Name?: string;
  onResetGame?: () => void;
  currentPlayer?: PieceColor;
  onMove?: (color: PieceColor) => void;
  gameState?: GameState;
  onGameStateChange?: React.Dispatch<React.SetStateAction<GameState>>;
  board?: (Piece | null)[][];
  playerColor?: PieceColor;
  onMoveMade?: (move: {
    from: BoardPosition;
    to: BoardPosition;
    actionType: 'move' | 'capture';
    pieceType: PieceType;
    resultsInCheck?: boolean;
    resultsInCheckmate?: boolean;
    resultsInStalemate?: boolean;
  }) => void;
}
