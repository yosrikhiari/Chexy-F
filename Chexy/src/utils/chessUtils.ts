import {Piece, BoardPosition, PieceColor, PieceType} from "@/Interfaces/types/chess";
import { RPGPiece } from "@/Interfaces/types/rpgChess";
import { GameMode } from "@/Interfaces/enums/GameMode";
import {gameSessionService} from '@/services/GameSessionService.ts';





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
        const moves = await calculateValidMovesForPiece(
          { row, col },
          board,
          attackingColor,
          gameId,
          gameMode,
          boardSize,
          false, // checkForCheck: false to prevent recursive check loops
          null,
          true // skipCastling: true to prevent recursive castling checks
        );
        if (moves.some(move => move.row === pos.row && move.col === pos.col)) {
          return true;
        }
      }
    }
  }
  return false;
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
  gameId: string,
  boardSize: number = 8
): Promise<boolean> => {
  // Create a deep copy of the board
  const testBoard = JSON.parse(JSON.stringify(board));

  // Make the move on the test board
  testBoard[to.row][to.col] = testBoard[from.row][from.col];
  testBoard[from.row][from.col] = null;

  // Find the king's new position (it might be the moving piece)
  const kingPos = findKingPosition(testBoard, movingColor, boardSize);
  if (!kingPos) return false;

  // Check if the king is under attack
  const opponentColor = movingColor === "white" ? "black" : "white";
  return await isPositionUnderAttack(
    kingPos,
    testBoard,
    opponentColor,
    gameId,
    "CLASSIC_MULTIPLAYER",
    boardSize
  );
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
  await verifyBoardState(gameId);
  return calculateValidMovesForPiece(pos, board, currentPlayer, gameId, gameMode, boardSize, checkForCheck, enPassantTarget);
};

const verifyBoardState = async (gameId: string) => {
  try {
    const session = await gameSessionService.getGameSession(gameId);
    console.log("Server board state:");
    printBoard(session.board);
    return session.board;
  } catch (error) {
    console.error("Failed to verify board state:", error);
    return null;
  }
};

export const printBoard = (board: (Piece | null)[][]) => {
  console.log("   a b c d e f g h");
  for (let row = 0; row < 8; row++) {
    let rowStr = `${8 - row} `;
    for (let col = 0; col < 8; col++) {
      const piece = board[row][col];
      if (!piece) {
        rowStr += ". ";
      } else {
        const color = piece.color === "white" ? "w" : "b";
        let typeChar;
        switch (piece.type) {
          case "king": typeChar = "K"; break;
          case "queen": typeChar = "Q"; break;
          case "rook": typeChar = "R"; break;
          case "bishop": typeChar = "B"; break;
          case "knight": typeChar = "N"; break;
          case "pawn": typeChar = "P"; break;
          default: typeChar = "?"; break;
        }
        rowStr += `${color}${typeChar} `;
      }
    }
    console.log(rowStr + ` ${8 - row}`);
  }
  console.log("   a b c d e f g h");
};


export const normalizeBoard = (board: any[][]): Piece[][] => {
  return board.map(row =>
    row.map(cell => {
      if (!cell || typeof cell.type !== 'string' || typeof cell.color !== 'string') {
        return null;
      }
      const normalizedType = cell.type.toLowerCase() as PieceType;
      const normalizedColor = cell.color.toLowerCase() as PieceColor;
      if (
        ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'].includes(normalizedType) &&
        ['white', 'black'].includes(normalizedColor)
      ) {
        return {
          ...cell,
          type: normalizedType,
          color: normalizedColor,
          hasMoved: cell.hasMoved ?? false,
          enPassantTarget: cell.enPassantTarget ?? false,
        };
      }
      return null;
    })
  );
};

export const calculateValidMovesForPiece = async (
  pos: BoardPosition,
  board: (Piece | RPGPiece | null)[][],
  currentPlayer: PieceColor,
  gameId: string,
  gameMode: GameMode,
  boardSize: number = 8,
  checkForCheck: boolean = true,
  enPassantTarget: BoardPosition | null = null,
  skipCastling: boolean = false
): Promise<BoardPosition[]> => {
  const piece = board[pos.row][pos.col];
  if (!piece || piece.color !== currentPlayer) {
    return [];
  }

  let moves: BoardPosition[] = [];

  // Local move calculation
  switch (piece.type) {
    case "pawn": {
      const direction = piece.color === "white" ? -1 : 1; // White moves up, black moves down
      const startRow = piece.color === "white" ? boardSize - 2 : 1;
      const isInitialPosition = pos.row === startRow;

      // Single move forward
      const singleMove = { row: pos.row + direction, col: pos.col };
      if (isValidPosition(singleMove, boardSize) && !board[singleMove.row][singleMove.col]) {
        moves.push(singleMove);

        // Double move from initial position
        if (isInitialPosition && !piece.hasMoved) {
          const doubleMove = { row: pos.row + 2 * direction, col: pos.col };
          const intermediatePos = { row: pos.row + direction, col: pos.col };
          if (isValidPosition(doubleMove, boardSize) &&
            !board[doubleMove.row][doubleMove.col] &&
            !board[intermediatePos.row][intermediatePos.col]) {
            moves.push(doubleMove);
          }
        }
      }

      // Capture moves
      for (const offsetCol of [-1, 1]) {
        const capturePos = {
          row: pos.row + direction,
          col: pos.col + offsetCol
        };

        if (isValidPosition(capturePos, boardSize)) {
          const targetPiece = board[capturePos.row][capturePos.col];

          // Regular capture
          if (targetPiece && targetPiece.color !== piece.color) {
            moves.push(capturePos);
          }
          // En passant capture
          else if (enPassantTarget &&
            capturePos.row === enPassantTarget.row &&
            capturePos.col === enPassantTarget.col) {
            moves.push(capturePos);
          }
        }
      }
      break;
    }
    case "knight": {
      const knightMoves = [
        [-2, -1], [-2, 1],
        [-1, -2], [-1, 2],
        [1, -2], [1, 2],
        [2, -1], [2, 1]
      ];

      for (const [rowOffset, colOffset] of knightMoves) {
        const move = {
          row: pos.row + rowOffset,
          col: pos.col + colOffset
        };

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
      // Normal king moves
      for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
          if (rowOffset === 0 && colOffset === 0) continue;

          const move = {
            row: pos.row + rowOffset,
            col: pos.col + colOffset
          };

          if (isValidPosition(move, boardSize)) {
            const targetPiece = board[move.row][move.col];
            if (!targetPiece || targetPiece.color !== piece.color) {
              moves.push(move);
            }
          }
        }
      }

      // Castling moves (only if king hasn't moved and castling is not skipped)
      if (!piece.hasMoved && !skipCastling) {
        // King-side castling
        if (await canCastle(board, pos, currentPlayer, "king", gameId, gameMode)) {
          const kingSideCastle = {
            row: pos.row,
            col: pos.col + 2
          };
          moves.push(kingSideCastle);
        }

        // Queen-side castling
        if (await canCastle(board, pos, currentPlayer, "queen", gameId, gameMode)) {
          const queenSideCastle = {
            row: pos.row,
            col: pos.col - 2
          };
          moves.push(queenSideCastle);
        }
      }
      break;
    }
    case "rook":
    case "bishop":
    case "queen": {
      const directions = [];

      // Rook and queen can move horizontally/vertically
      if (piece.type === "rook" || piece.type === "queen") {
        directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      }

      // Bishop and queen can move diagonally
      if (piece.type === "bishop" || piece.type === "queen") {
        directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
      }

      for (const [rowDir, colDir] of directions) {
        let currPos = {
          row: pos.row + rowDir,
          col: pos.col + colDir
        };

        while (isValidPosition(currPos, boardSize)) {
          const targetPiece = board[currPos.row][currPos.col];

          if (!targetPiece) {
            moves.push({ ...currPos });
          } else {
            if (targetPiece.color !== piece.color) {
              moves.push({ ...currPos }); // Capture
            }
            break; // Blocked by any piece
          }

          currPos = {
            row: currPos.row + rowDir,
            col: currPos.col + colDir
          };
        }
      }
      break;
    }
  }

  // Filter moves that would put the player in check if needed
  if (checkForCheck) {
    const validMoves = [];
    for (const move of moves) {
      try {
        const wouldBeCheck = await wouldBeInCheckAfterMove(
          pos,
          move,
          board,
          piece.color,
          gameId,
          boardSize
        );
        if (!wouldBeCheck) {
          validMoves.push(move);
        }
      } catch (error) {
        console.error(`Error checking move [${move.row},${move.col}]:`, error);
      }
    }
    moves = validMoves;
  }
  return moves;
};

const canCastle = async (
  board: (Piece | RPGPiece | null)[][],
  kingPos: BoardPosition,
  color: PieceColor,
  side: "king" | "queen",
  gameId: string,
  gameMode: GameMode
): Promise<boolean> => {
  console.log(`Checking ${color} ${side}-side castling at row ${kingPos.row}, col ${kingPos.col}`);
  const row = color === "white" ? 7 : 0;
  if (kingPos.row !== row) {
    console.log("Wrong row");
    return false;
  }

  // Check if king is currently in check
  const isKingInCheck = await isPositionUnderAttack(
    kingPos,
    board,
    color === "white" ? "black" : "white",
    gameId,
    gameMode
  );
  if (isKingInCheck) {
    console.log("King is in check, cannot castle");
    return false;
  }

  // Check if path is clear and squares aren't under attack
  const direction = side === "king" ? 1 : -1;
  const rookCol = side === "king" ? 7 : 0;

  // Check if rook exists and hasn't moved
  const rook = board[row][rookCol];
  if (!rook || rook.type !== "rook" || rook.color !== color || rook.hasMoved) {
    console.log("Rook check failed:", { exists: !!rook, type: rook?.type, hasMoved: rook?.hasMoved });
    return false;
  }

  // Check squares between king and rook are empty
  let col = kingPos.col + direction;
  while (col !== rookCol) {
    if (board[row][col] !== null) {
      return false;
    }
    col += direction;
  }

  // Check if king would pass through or end up in check
  const squaresToCheck = [
    kingPos.col + direction,
    kingPos.col + 2 * direction
  ].filter(c => c !== kingPos.col); // Don't check starting square

  for (const col of squaresToCheck) {
    if (col < 0 || col >= 8) continue;
    const isUnderAttack = await isPositionUnderAttack(
      { row, col },
      board,
      color === "white" ? "black" : "white",
      gameId,
      gameMode
    );
    if (isUnderAttack) {
      return false;
    }
  }

  return true;
};
