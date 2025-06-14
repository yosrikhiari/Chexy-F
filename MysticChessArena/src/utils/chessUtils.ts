import { Piece, BoardPosition, PieceColor, PieceType } from "@/Interfaces/types/chess";
import { RPGPiece } from "@/Interfaces/types/rpgChess";
import { EnhancedRPGPiece } from "@/Interfaces/types/enhancedRpgChess";
import { GameSession } from "@/Interfaces/types/GameSession";
import { RPGGameState } from "@/Interfaces/types/rpgChess";
import { GameMode } from "@/Interfaces/enums/GameMode";
import {chessGameService} from '@/services/ChessGameService.ts';
import {gameSessionService} from '@/services/GameSessionService.ts';
import {rpgGameService} from '@/services/RPGGameService.ts';
import {realtimeService} from '@/services/RealtimeService.ts';


// Utility to fetch board and board size from backend
const fetchBoardAndSize = async (
  gameId: string,
  gameMode: GameMode
): Promise<{ board: (Piece | RPGPiece | EnhancedRPGPiece | null)[][]; boardSize: number }> => {
  try {
    if (
      gameMode === "CLASSIC_MULTIPLAYER" ||
      gameMode === "CLASSIC_SINGLE_PLAYER" ||
      gameMode === "TOURNAMENT"
    ) {
      const session: GameSession = await gameSessionService.getGameSession(gameId);
      return {
        board: (session.board as (Piece | null)[][]) || createEmptyBoard(8),
        boardSize: 8,
      };
    } else if (
      gameMode === "SINGLE_PLAYER_RPG" ||
      gameMode === "MULTIPLAYER_RPG" ||
      gameMode === "ENHANCED_RPG"
    ) {
      const rpgState: RPGGameState = await rpgGameService.getRPGGame(gameId);
      const boardSize = rpgState.boardSize || 8;
      let board = createEmptyBoard(boardSize);

      // Place player and enemy armies
      if (rpgState.playerArmy) {
        board = placePiecesOnBoard(board, rpgState.playerArmy);
      }
      if (rpgState.enemyArmy) {
        board = placePiecesOnBoard(board, rpgState.enemyArmy);
      }

      return { board, boardSize };
    }
    return { board: createEmptyBoard(8), boardSize: 8 }; // Fallback
  } catch (error) {
    console.error("Failed to fetch board:", error);
    return { board: createEmptyBoard(8), boardSize: 8 }; // Fallback
  }
};

// Create an empty board
const createEmptyBoard = (size: number): (Piece | RPGPiece | EnhancedRPGPiece | null)[][] => {
  return Array(size).fill(null).map(() => Array(size).fill(null));
};

// Place pieces on board
const placePiecesOnBoard = (
  board: (Piece | RPGPiece | EnhancedRPGPiece | null)[][],
  pieces: (Piece | RPGPiece | EnhancedRPGPiece)[]
): (Piece | RPGPiece | EnhancedRPGPiece | null)[][] => {
  const newBoard = board.map(row => [...row]);
  pieces.forEach(piece => {
    const { position } = piece as RPGPiece;
    if (
      position &&
      position.row >= 0 &&
      position.row < board.length &&
      position.col >= 0 &&
      position.col < board[0].length
    ) {
      newBoard[position.row][position.col] = { ...piece };
    }
  });
  return newBoard;
};

const validateMoveWithBackend = async (
  gameId: string,
  from: BoardPosition,
  to: BoardPosition
): Promise<boolean> => {
  try {
    if (!gameId) {
      console.error("Game ID is required for validation");
      return false;
    }

    const movever2 = {
      row: from.row,
      col: from.col,
      torow: to.row,
      tocol: to.col
    };

    return await chessGameService.validateMove(gameId, movever2);
  } catch (error) {
    console.error("Failed to validate move:", error);
    return false;
  }
};

export const isValidPosition = (pos: BoardPosition, boardSize: number = 8): boolean => {
  return pos.row >= 0 && pos.row < boardSize && pos.col >= 0 && pos.col < boardSize;
};

export const canPromotePawn = (piece: Piece | RPGPiece, row: number, boardSize: number): boolean => {
  if (piece.type !== "pawn") return false;
  return (piece.color === "white" && row === 0) || (piece.color === "black" && row === boardSize - 1);
};

export const isEnPassantMove = (
  from: BoardPosition,
  to: BoardPosition,
  board: (Piece | RPGPiece | null)[][],
  enPassantTarget: BoardPosition | null
): boolean => {
  const piece = board[from.row][from.col];
  if (!piece || piece.type !== "pawn" || !enPassantTarget) return false;
  return to.row === enPassantTarget.row && to.col === enPassantTarget.col;
};

export const isPositionUnderAttack = async (
  pos: BoardPosition,
  board: (Piece | RPGPiece | null)[][],
  attackingColor: PieceColor,
  gameId: string,
  gameMode: GameMode,
  boardSize: number = 8
): Promise<boolean> => {
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      const piece = board[row][col];
      if (piece && piece.color === attackingColor) {
        // If we don't have a game ID, use local validation
        if (!gameId) {
          const moves = await calculateValidMovesForPiece(
            {row, col},
            board,
            attackingColor,
            "", // Empty game ID
            gameMode,
            boardSize,
            false
          );
          if (moves.some(move => move.row === pos.row && move.col === pos.col)) {
            return true;
          }
        } else {
          const moves = await calculateValidMovesForPiece(
            { row, col },
            board,
            attackingColor,
            gameId,
            gameMode,
            boardSize,
            false
          );
          if (moves.some(move => move.row === pos.row && move.col === pos.col)) {
            return true;
          }
        }
      }
    }
  }
  return false;
};

export const isInCheck = async (
  gameId: string,
  kingColor: PieceColor,
  boardSize: number = 8,
  fallbackBoard?: (Piece | RPGPiece | null)[][]
): Promise<boolean> => {
  try {
    return await chessGameService.isCheck(gameId, kingColor);
  } catch (error) {
    console.error("Failed to check for check:", error);
    if (fallbackBoard) {
      const kingPos = findKingPosition(fallbackBoard, kingColor, boardSize);
      if (!kingPos) return false;
      const opponentColor = kingColor === "white" ? "black" : "white";
      return await isPositionUnderAttack(kingPos, fallbackBoard, opponentColor, gameId, "CLASSIC_MULTIPLAYER", boardSize);
    }
    return false;
  }
};

export const findKingPosition = (
  board: (Piece | RPGPiece | null)[][],
  color: PieceColor,
  boardSize: number = 8
): BoardPosition | null => {
  for (let row = 0; row < boardSize; row++) {
    for (let col = 0; col < boardSize; col++) {
      const piece = board[row][col];
      if (piece && piece.type === "king" && piece.color === color) {
        return { row, col };
      }
    }
  }
  return null;
};

export const wouldBeInCheckAfterMove = async (
  from: BoardPosition,
  to: BoardPosition,
  board: (Piece | RPGPiece | null)[][],
  movingColor: PieceColor,
  gameId: string, // Make gameId required
  boardSize: number = 8
): Promise<boolean> => {
  const testBoard = board.map(row => [...row]);
  testBoard[to.row][to.col] = testBoard[from.row][from.col];
  testBoard[from.row][from.col] = null;
  const opponentColor = movingColor === "white" ? "black" : "white";

  const kingPos = findKingPosition(testBoard, movingColor, boardSize);
  if (!kingPos) return false;

  return await isPositionUnderAttack(
    kingPos,
    testBoard,
    opponentColor,
    gameId, // Use the provided gameId
    "CLASSIC_MULTIPLAYER",
    boardSize
  );
};

export const isCheckmate = async (
  gameId: string,
  kingColor: PieceColor,
  boardSize: number = 8,
  fallbackBoard?: (Piece | RPGPiece | null)[][]
): Promise<boolean> => {
  try {
    return await chessGameService.isCheckmate(gameId, kingColor);
  } catch (error) {
    console.error("Failed to check for checkmate:", error);
    if (fallbackBoard && (await isInCheck(gameId, kingColor, boardSize, fallbackBoard))) {
      for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
          const piece = fallbackBoard[row][col];
          if (piece && piece.color === kingColor) {
            const moves = await calculateValidMovesForPiece(
              { row, col },
              fallbackBoard,
              kingColor,
              gameId,
              "CLASSIC_MULTIPLAYER",
              boardSize,
              true
            );
            if (moves.length > 0) {
              return false;
            }
          }
        }
      }
      return true;
    }
    return false;
  }
};

export const calculateValidMoves = async (
  pos: BoardPosition,
  board: (Piece | RPGPiece | null)[][],
  currentPlayer: PieceColor,
  gameId: string,
  gameMode: GameMode,
  boardSize: number = 8,
  checkForCheck: boolean = true,
  enPassantTarget: BoardPosition | null = null
): Promise<BoardPosition[]> => {
  return calculateValidMovesForPiece(pos, board, currentPlayer, gameId, gameMode, boardSize, checkForCheck, enPassantTarget);
};

export const calculateValidMovesForPiece = async (
  pos: BoardPosition,
  board: (Piece | RPGPiece | null)[][],
  currentPlayer: PieceColor,
  gameId: string,
  gameMode: GameMode,
  boardSize: number = 8,
  checkForCheck: boolean = true,
  enPassantTarget: BoardPosition | null = null
): Promise<BoardPosition[]> => {
  const piece = board[pos.row][pos.col];
  if (!piece || piece.color !== currentPlayer) return [];

  let moves: BoardPosition[] = [];

  // Local move calculation
  switch (piece.type) {
    case "pawn": {
      const direction = piece.color === "white" ? -1 : 1;
      const startRow = piece.color === "white" ? boardSize - 2 : 1;

      // Forward move
      const singleMove = { row: pos.row + direction, col: pos.col };
      if (isValidPosition(singleMove, boardSize) && !board[singleMove.row][singleMove.col]) {
        moves.push(singleMove);

        // Double move from start
        if (pos.row === startRow) {
          const doubleMove = { row: pos.row + 2 * direction, col: pos.col };
          if (
            isValidPosition(doubleMove, boardSize) &&
            !board[doubleMove.row][doubleMove.col]
          ) {
            moves.push(doubleMove);
          }
        }
      }

      // Captures
      for (const offsetCol of [-1, 1]) {
        const capturePos = { row: pos.row + direction, col: pos.col + offsetCol };
        if (isValidPosition(capturePos, boardSize)) {
          const targetPiece = board[capturePos.row][capturePos.col];
          if (targetPiece && targetPiece.color !== piece.color) {
            moves.push(capturePos);
          } else if (
            enPassantTarget &&
            capturePos.row === enPassantTarget.row &&
            capturePos.col === enPassantTarget.col
          ) {
            moves.push(capturePos);
          }
        }
      }
      break;
    }
    case "knight": {
      const knightOffsets = [
        [-2, -1],
        [-2, 1],
        [-1, -2],
        [-1, 2],
        [1, -2],
        [1, 2],
        [2, -1],
        [2, 1],
      ];
      for (const [rowOffset, colOffset] of knightOffsets) {
        const move = { row: pos.row + rowOffset, col: pos.col + colOffset };
        if (isValidPosition(move, boardSize)) {
          const targetPiece = board[move.row][move.col];
          if (!targetPiece || targetPiece.color !== piece.color) {
            moves.push(move);
          }
        }
      }
      break;
    }
    case "king": {
      for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
          if (rowOffset === 0 && colOffset === 0) continue;
          const move = { row: pos.row + rowOffset, col: pos.col + colOffset };
          if (isValidPosition(move, boardSize)) {
            const targetPiece = board[move.row][move.col];
            if (!targetPiece || targetPiece.color !== piece.color) {
              moves.push(move);
            }
          }
        }
      }
      break;
    }
    case "rook": {
      const directions = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ];
      for (const [rowDir, colDir] of directions) {
        let currPos = { row: pos.row + rowDir, col: pos.col + colDir };
        while (isValidPosition(currPos, boardSize)) {
          const targetPiece = board[currPos.row][currPos.col];
          if (!targetPiece) {
            moves.push({ ...currPos });
          } else if (targetPiece.color !== piece.color) {
            moves.push({ ...currPos });
            break;
          } else {
            break;
          }
          currPos = { row: currPos.row + rowDir, col: currPos.col + colDir };
        }
      }
      break;
    }
    case "bishop": {
      const directions = [
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];
      for (const [rowDir, colDir] of directions) {
        let currPos = { row: pos.row + rowDir, col: pos.col + colDir };
        while (isValidPosition(currPos, boardSize)) {
          const targetPiece = board[currPos.row][currPos.col];
          if (!targetPiece) {
            moves.push({ ...currPos });
          } else if (targetPiece.color !== piece.color) {
            moves.push({ ...currPos });
            break;
          } else {
            break;
          }
          currPos = { row: currPos.row + rowDir, col: currPos.col + colDir };
        }
      }
      break;
    }
    case "queen": {
      const directions = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
        [-1, -1],
        [-1, 1],
        [1, -1],
        [1, 1],
      ];
      for (const [rowDir, colDir] of directions) {
        let currPos = { row: pos.row + rowDir, col: pos.col + colDir };
        while (isValidPosition(currPos, boardSize)) {
          const targetPiece = board[currPos.row][currPos.col];
          if (!targetPiece) {
            moves.push({ ...currPos });
          } else if (targetPiece.color !== piece.color) {
            moves.push({ ...currPos });
            break;
          } else {
            break;
          }
          currPos = { row: currPos.row + rowDir, col: currPos.col + colDir };
        }
      }
      break;
    }
  }

  // Filter moves with backend validation for critical modes
  if (
    gameMode === "CLASSIC_MULTIPLAYER" ||
    gameMode === "CLASSIC_SINGLE_PLAYER" ||
    gameMode === "MULTIPLAYER_RPG" ||
    gameMode === "TOURNAMENT" ||
    gameMode === "ENHANCED_RPG"
  ) {
    const validMoves = await Promise.all(
      moves.map(async move => {
        const isValid = await validateMoveWithBackend(gameId, pos, move);
        return isValid ? move : null;
      })
    );
    moves = validMoves.filter((move): move is BoardPosition => move !== null);

    // Broadcast state for multiplayer modes
    if (gameMode === "CLASSIC_MULTIPLAYER" || gameMode === "MULTIPLAYER_RPG") {
      try {
        await realtimeService.broadcastGameState(gameId);
      } catch (error) {
        console.error("Failed to broadcast game state:", error);
      }
    }
  }

  // Filter moves that would put the player in check
  if (checkForCheck) {
    moves = await Promise.all(
      moves.map(async move => {
        const wouldBeCheck = await wouldBeInCheckAfterMove(
          pos,
          move,
          board,
          piece.color,
          gameId,
          boardSize
        );
        return wouldBeCheck ? null : move;
      })
    );
    moves = moves.filter((move): move is BoardPosition => move !== null);
  }

  return moves;
};
