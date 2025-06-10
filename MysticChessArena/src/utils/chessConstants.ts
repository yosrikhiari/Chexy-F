import { Piece, BoardPosition } from "@/Interfaces/types/chess";
import { RPGPiece } from "@/Interfaces/types/rpgChess";
import { EnhancedRPGPiece } from "@/Interfaces/types/enhancedRpgChess";
import { GameSession } from "@/Interfaces/types/GameSession";
import { RPGGameState } from "@/Interfaces/types/rpgChess";
import {gameService} from '@/services/GameService.ts';
import {gameSessionService} from '@/services/GameSessionService.ts';
import {rpgGameService} from '@/services/RPGGameService.ts';


// Static initialBoard for classic chess (fallback)
export const initialBoard: (Piece | null)[][] = [
  [
    { type: 'rook', color: 'black' },
    { type: 'knight', color: 'black' },
    { type: 'bishop', color: 'black' },
    { type: 'queen', color: 'black' },
    { type: 'king', color: 'black' },
    { type: 'bishop', color: 'black' },
    { type: 'knight', color: 'black' },
    { type: 'rook', color: 'black' },
  ],
  Array(8).fill(null).map(() => ({ type: 'pawn', color: 'black' })),
  Array(8).fill(null),
  Array(8).fill(null),
  Array(8).fill(null),
  Array(8).fill(null),
  Array(8).fill(null).map(() => ({ type: 'pawn', color: 'white' })),
  [
    { type: 'rook', color: 'white' },
    { type: 'knight', color: 'white' },
    { type: 'bishop', color: 'white' },
    { type: 'queen', color: 'white' },
    { type: 'king', color: 'white' },
    { type: 'bishop', color: 'white' },
    { type: 'knight', color: 'white' },
    { type: 'rook', color: 'white' },
  ],
];

// Initialize an empty board based on size
const createEmptyBoard = (size: number): (Piece | RPGPiece | EnhancedRPGPiece | null)[][] => {
  return Array(size).fill(null).map(() => Array(size).fill(null));
};

// Place pieces on the board based on their positions
const placePiecesOnBoard = (
  board: (Piece | RPGPiece | EnhancedRPGPiece | null)[][],
  pieces: (Piece | RPGPiece | EnhancedRPGPiece)[],
  gameMode: string
): (Piece | RPGPiece | EnhancedRPGPiece | null)[][] => {
  const newBoard = board.map(row => [...row]); // Deep copy
  pieces.forEach(piece => {
    const { position } = piece as RPGPiece; // RPGPiece and EnhancedRPGPiece have position
    if (position && position.row >= 0 && position.row < board.length && position.col >= 0 && position.col < board[0].length) {
      newBoard[position.row][position.col] = { ...piece };
    }
  });
  return newBoard;
};

// Fetch board state from backend
export const fetchBoardState = async (
  gameId: string,
  gameMode: string
): Promise<(Piece | RPGPiece | EnhancedRPGPiece | null)[][]> => {
  try {
    if (gameMode === 'CLASSIC_MULTIPLAYER' || gameMode === 'TOURNAMENT') {
      // Fetch board for classic chess or tournament
      const session: GameSession = await gameSessionService.getGameSession(gameId);
      if (session.board) {
        return session.board as (Piece | null)[][];
      }
      // Fallback to initialBoard for classic chess
      return initialBoard;
    } else if (gameMode === 'SINGLE_PLAYER_RPG' || gameMode === 'MULTIPLAYER_RPG' || gameMode === 'ENHANCED_RPG') {
      // Fetch board for RPG modes
      const rpgGameState: RPGGameState = await rpgGameService.getRPGGame(gameId);
      const { boardSize, playerArmy, enemyArmy } = rpgGameState;

      // Initialize empty board with dynamic size
      let board = createEmptyBoard(boardSize);

      // Place player army
      if (playerArmy && playerArmy.length > 0) {
        board = placePiecesOnBoard(board, playerArmy, gameMode);
      }

      // Place enemy army (if applicable)
      if (enemyArmy && enemyArmy.length > 0) {
        board = placePiecesOnBoard(board, enemyArmy, gameMode);
      }

      return board;
    } else {
      console.warn(`Unsupported game mode: ${gameMode}`);
      return initialBoard; // Fallback
    }
  } catch (error) {
    console.error("Failed to fetch board state:", error);
    return initialBoard; // Fallback to static board
  }
};

// Update board state after a move (optional utility function)
export const updateBoardState = async (
  gameId: string,
  move: { from: BoardPosition; to: BoardPosition },
  gameMode: string
): Promise<(Piece | RPGPiece | EnhancedRPGPiece | null)[][]> => {
  try {
    if (gameMode === 'CLASSIC_MULTIPLAYER' || gameMode === 'TOURNAMENT') {
      // Execute move for classic chess
      const gameStateData = await gameService.executeMove(gameId, move);
      const session = await gameSessionService.getGameSession(gameId);
      return (session.board as (Piece | null)[][]) || initialBoard;
    } else if (gameMode === 'SINGLE_PLAYER_RPG' || gameMode === 'MULTIPLAYER_RPG' || gameMode === 'ENHANCED_RPG') {
      // Execute move and fetch updated RPG game state
      await gameService.executeMove(gameId, move);
      return await fetchBoardState(gameId, gameMode);
    }
    return initialBoard; // Fallback
  } catch (error) {
    console.error("Failed to update board state:", error);
    return initialBoard; // Fallback
  }
};
