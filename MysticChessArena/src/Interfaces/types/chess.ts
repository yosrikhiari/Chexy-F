export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type PieceColor = 'white' | 'black';

export interface Piece {
  id?: string;
  type: PieceType;
  color: PieceColor;
  hasMoved?: boolean;
  enPassantTarget?: boolean;
  Position?: BoardPosition;
}

export interface BoardPosition {
  row: number;
  col: number;
}

export interface PlayerTimer {
  timeLeft: number; // in seconds
  active: boolean;
}

export interface GameTimers {
  white: PlayerTimer;
  black: PlayerTimer;
  defaultTime: number;
}

export interface GameState {
  gameSessionId: string;
  userId1: string;
  userId2: string;
  isCheck: boolean;
  isCheckmate: boolean;
  checkedPlayer: PieceColor | null;
  enPassantTarget: BoardPosition | null;
  currentTurn: PieceColor;
  moveCount: number;
  canWhiteCastleKingSide: boolean;
  canWhiteCastleQueenSide: boolean;
  canBlackCastleKingSide: boolean;
  canBlackCastleQueenSide: boolean;
}

export interface PlayerStats {
  playerId: string;
  name: string;
  points: number;
}

export type GameEndReason = 'checkmate' | 'timeout' | 'resignation';

export interface GameResult {
  winner: PieceColor;
  winnerName: string;
  pointsAwarded: number;
  gameEndReason: GameEndReason;
  gameid: string;
  winnerid: string;
}
