import {Piece, BoardPosition, PieceColor, PieceType} from "@/Interfaces/types/chess";
import { RPGPiece } from "@/Interfaces/types/rpgChess";
import { EnhancedRPGPiece } from "@/Interfaces/types/enhancedRpgChess";
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
  board: (Piece | RPGPiece | EnhancedRPGPiece | null)[][],
  currentPlayer: PieceColor,
  gameId: string,
  gameMode: GameMode,
  boardSize: number = 8,
  checkForCheck: boolean = true,
  enPassantTarget: BoardPosition | null = null
): Promise<BoardPosition[]> => {
  // For RPG modes, use simple movement validation
  if (gameMode === 'SINGLE_PLAYER_RPG' || gameMode === 'MULTIPLAYER_RPG' || gameMode === 'ENHANCED_RPG') {
    return calculateRPGValidMoves(pos, board, currentPlayer, boardSize);
  }
  
  await verifyBoardState(gameId);
  return calculateValidMovesForPiece(pos, board, currentPlayer, gameId, gameMode, boardSize, checkForCheck, enPassantTarget);
};

/** Calculate valid moves for RPG mode - uses the same patterns as classic chess */
export const calculateRPGValidMoves = (
  pos: BoardPosition,
  board: (Piece | RPGPiece | EnhancedRPGPiece | null)[][],
  currentPlayer: PieceColor,
  boardSize: number,
  enPassantTarget: BoardPosition | null = null
): BoardPosition[] => {
  const piece = board[pos.row][pos.col];
  if (!piece || piece.color !== currentPlayer) {
    console.log('RPG: No piece or wrong color:', { piece, currentPlayer, pos });
    return [];
  }

  console.log('RPG: Processing piece:', { type: piece.type, color: piece.color, pos });
  let moves: BoardPosition[] = [];

  // Convert piece type to lowercase to handle any case issues
  const pieceType = piece.type.toLowerCase();
  console.log('RPG: Piece type for switch:', pieceType);
  
  // Check for custom RPG piece types and names first
  const pieceName = 'name' in piece ? piece.name.toLowerCase() : '';
  if (pieceType === 'dreamer' || pieceType === 'preacher' || pieceType === 'serpent' || pieceType === 'shadow' || pieceType === 'fire_mage' || pieceType === 'ice_knight' || pieceType === 'shadow_assassin' ||
      pieceName.includes('obsidian') || pieceName.includes('guard') || pieceName.includes('mage') || pieceName.includes('knight') || pieceName.includes('assassin') || pieceName.includes('dreamer') || pieceName.includes('preacher') || pieceName.includes('serpent') || pieceName.includes('shadow') || pieceName.includes('fire') || pieceName.includes('ice')) {
    return calculateCustomRPGMoves(pos, board, currentPlayer, boardSize, piece);
  }
  
  switch (pieceType) {
    case "pawn": {
      console.log('RPG: Processing PAWN moves');
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

      // Capture moves (diagonal)
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

      // Castling moves (simplified for RPG mode - no check validation)
      if (!piece.hasMoved) {
        const row = piece.color === "white" ? boardSize - 1 : 0;
        
        // King-side castling
        if (pos.col === Math.floor(boardSize / 2) - 1) { // King in center for castling
          const kingSideRook = board[row][boardSize - 1];
          if (kingSideRook && 
              kingSideRook.type === "rook" && 
              kingSideRook.color === piece.color && 
              !kingSideRook.hasMoved) {
            // Check if path is clear
            let pathClear = true;
            for (let col = pos.col + 1; col < boardSize - 1; col++) {
              if (board[row][col] !== null) {
                pathClear = false;
                break;
              }
            }
            if (pathClear) {
              moves.push({ row: pos.row, col: pos.col + 2 });
            }
          }
        }

        // Queen-side castling
        if (pos.col === Math.floor(boardSize / 2) - 1) { // King in center for castling
          const queenSideRook = board[row][0];
          if (queenSideRook && 
              queenSideRook.type === "rook" && 
              queenSideRook.color === piece.color && 
              !queenSideRook.hasMoved) {
            // Check if path is clear
            let pathClear = true;
            for (let col = 1; col < pos.col; col++) {
              if (board[row][col] !== null) {
                pathClear = false;
                break;
              }
            }
            if (pathClear) {
              moves.push({ row: pos.row, col: pos.col - 2 });
            }
          }
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

  console.log(`RPG Valid moves for ${piece.type} at [${pos.row}, ${pos.col}]:`, moves);
  return moves;
};

/** Calculate custom movement patterns for RPG pieces based on their names/types */
const calculateCustomRPGMoves = (
  pos: BoardPosition,
  board: (Piece | RPGPiece | EnhancedRPGPiece | null)[][],
  currentPlayer: PieceColor,
  boardSize: number,
  piece: Piece | RPGPiece | EnhancedRPGPiece
): BoardPosition[] => {
  const pieceType = piece.type.toLowerCase();
  const pieceName = 'name' in piece ? piece.name.toLowerCase() : '';
  let moves: BoardPosition[] = [];

  console.log('RPG: Processing custom piece:', { type: pieceType, name: pieceName });

  // Obsidian Guard - Enhanced Rook with defensive abilities
  if (pieceName.includes('obsidian') || pieceName.includes('guard')) {
    console.log('RPG: Obsidian Guard movement - enhanced rook with defensive abilities');
    
    // Standard rook movement (horizontal/vertical)
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
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
            moves.push({ ...currPos }); // Can capture
          }
          break;
        }
        
        currPos = {
          row: currPos.row + rowDir,
          col: currPos.col + colDir
        };
      }
    }
    
    // Defensive ability - can move to protect adjacent friendly pieces (move to squares next to allies)
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let colOffset = -1; colOffset <= 1; colOffset++) {
        if (rowOffset === 0 && colOffset === 0) continue;
        
        const adjacentPos = {
          row: pos.row + rowOffset,
          col: pos.col + colOffset
        };
        
        if (isValidPosition(adjacentPos, boardSize)) {
          const targetPiece = board[adjacentPos.row][adjacentPos.col];
          if (targetPiece && targetPiece.color === piece.color) {
            // Can move to protect adjacent friendly pieces
            moves.push(adjacentPos);
          }
        }
      }
    }
  }

  // Enhanced Knight variations
  else if (pieceName.includes('knight') && (pieceName.includes('shadow') || pieceName.includes('ice') || pieceName.includes('fire') || pieceName.includes('cursed'))) {
    console.log('RPG: Enhanced Knight movement - knight-like with special abilities');
    
    // Standard knight movement
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
    
    // Special abilities based on type
    if (pieceName.includes('shadow')) {
      // Shadow Knight - can teleport to any empty square
      for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
          if (row === pos.row && col === pos.col) continue;
          const targetPiece = board[row][col];
          if (!targetPiece) {
            moves.push({ row, col });
          }
        }
      }
    } else if (pieceName.includes('ice')) {
      // Ice Knight - can freeze adjacent squares
      for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
          if (rowOffset === 0 && colOffset === 0) continue;
          const adjacentPos = {
            row: pos.row + rowOffset,
            col: pos.col + colOffset
          };
          if (isValidPosition(adjacentPos, boardSize)) {
            const targetPiece = board[adjacentPos.row][adjacentPos.col];
            if (targetPiece && targetPiece.color !== piece.color) {
              moves.push(adjacentPos);
            }
          }
        }
      }
    } else if (pieceName.includes('fire')) {
      // Fire Knight - can attack from 2 squares away
      for (let rowOffset = -2; rowOffset <= 2; rowOffset++) {
        for (let colOffset = -2; colOffset <= 2; colOffset++) {
          if (rowOffset === 0 && colOffset === 0) continue;
          if (Math.abs(rowOffset) === 1 && Math.abs(colOffset) === 1) continue;
          const firePos = {
            row: pos.row + rowOffset,
            col: pos.col + colOffset
          };
          if (isValidPosition(firePos, boardSize)) {
            const targetPiece = board[firePos.row][firePos.col];
            if (targetPiece && targetPiece.color !== piece.color) {
              moves.push(firePos);
            }
          }
        }
      }
    } else if (pieceName.includes('cursed')) {
      // Cursed Knight - can move through friendly pieces
      const knightMovesExtended = [
        [-2, -1], [-2, 1],
        [-1, -2], [-1, 2],
        [1, -2], [1, 2],
        [2, -1], [2, 1]
      ];
      
      for (const [rowOffset, colOffset] of knightMovesExtended) {
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
  }

  // Enhanced Pawn variations
  else if (pieceName.includes('pawn') && (pieceName.includes('shadow') || pieceName.includes('brave') || pieceName.includes('shield'))) {
    console.log('RPG: Enhanced Pawn movement - pawn-like with special abilities');
    
    const direction = piece.color === "white" ? -1 : 1;
    const startRow = piece.color === "white" ? boardSize - 2 : 1;
    const isInitialPosition = pos.row === startRow;
    
    // Standard pawn movement
    const singleMove = { row: pos.row + direction, col: pos.col };
    if (isValidPosition(singleMove, boardSize) && !board[singleMove.row][singleMove.col]) {
      moves.push(singleMove);
      
      if (isInitialPosition && !piece.hasMoved) {
        const doubleMove = { row: pos.row + 2 * direction, col: pos.col };
        if (isValidPosition(doubleMove, boardSize) && !board[doubleMove.row][doubleMove.col]) {
          moves.push(doubleMove);
        }
      }
    }
    
    // Diagonal captures
    for (const offsetCol of [-1, 1]) {
      const capturePos = {
        row: pos.row + direction,
        col: pos.col + offsetCol
      };
      
      if (isValidPosition(capturePos, boardSize)) {
        const targetPiece = board[capturePos.row][capturePos.col];
        if (targetPiece && targetPiece.color !== piece.color) {
          moves.push(capturePos);
        }
      }
    }
    
    // Special abilities based on type
    if (pieceName.includes('shadow')) {
      // Shadow Pawn - can move diagonally forward even without capturing
      for (const offsetCol of [-1, 1]) {
        const diagonalMove = {
          row: pos.row + direction,
          col: pos.col + offsetCol
        };
        
        if (isValidPosition(diagonalMove, boardSize)) {
          const targetPiece = board[diagonalMove.row][diagonalMove.col];
          if (!targetPiece || targetPiece.color !== piece.color) {
            moves.push(diagonalMove);
          }
        }
      }
    } else if (pieceName.includes('brave')) {
      // Brave Pawn - can move 2 squares in any direction once per game
      if (!piece.hasMoved) {
        for (let rowOffset = -2; rowOffset <= 2; rowOffset++) {
          for (let colOffset = -2; colOffset <= 2; colOffset++) {
            if (rowOffset === 0 && colOffset === 0) continue;
            const braveMove = {
              row: pos.row + rowOffset,
              col: pos.col + colOffset
            };
            if (isValidPosition(braveMove, boardSize)) {
              const targetPiece = board[braveMove.row][braveMove.col];
              if (!targetPiece || targetPiece.color !== piece.color) {
                moves.push(braveMove);
              }
            }
          }
        }
      }
    } else if (pieceName.includes('shield')) {
      // Shield Pawn - can move to protect adjacent friendly pieces
      for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
        for (let colOffset = -1; colOffset <= 1; colOffset++) {
          if (rowOffset === 0 && colOffset === 0) continue;
          const protectPos = {
            row: pos.row + rowOffset,
            col: pos.col + colOffset
          };
          if (isValidPosition(protectPos, boardSize)) {
            const targetPiece = board[protectPos.row][protectPos.col];
            if (targetPiece && targetPiece.color === piece.color) {
              moves.push(protectPos);
            }
          }
        }
      }
    }
  }

  // Dreamer Pawn - Can move in any direction but only 1 square (represents uncertainty)
  if (pieceType === 'dreamer' || pieceName.includes('dreamer')) {
    console.log('RPG: Dreamer movement - can move 1 square in any direction');
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
  }
  
  // Preacher - Can move like a bishop but also has "convert" ability (capture from distance)
  else if (pieceType === 'preacher' || pieceName.includes('preacher')) {
    console.log('RPG: Preacher movement - bishop-like with conversion ability');
    
    // Bishop movement (diagonal)
    const directions = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
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
            moves.push({ ...currPos }); // Can capture
          }
          break;
        }
        
        currPos = {
          row: currPos.row + rowDir,
          col: currPos.col + colDir
        };
      }
    }
    
    // Conversion ability - can "capture" enemy pieces from 2 squares away diagonally
    for (const [rowDir, colDir] of directions) {
      const conversionPos = {
        row: pos.row + (rowDir * 2),
        col: pos.col + (colDir * 2)
      };
      
      if (isValidPosition(conversionPos, boardSize)) {
        const targetPiece = board[conversionPos.row][conversionPos.col];
        if (targetPiece && targetPiece.color !== piece.color) {
          moves.push(conversionPos);
        }
      }
    }
  }
  
  // Serpent King - Moves like a king but can "slither" through pieces (can move through friendly pieces)
  else if (pieceType === 'serpent' || pieceName.includes('serpent')) {
    console.log('RPG: Serpent movement - king-like with slithering ability');
    
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
    
    // Slithering ability - can move through friendly pieces diagonally
    const diagonalDirections = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [rowDir, colDir] of diagonalDirections) {
      let currPos = {
        row: pos.row + rowDir,
        col: pos.col + colDir
      };
      
      while (isValidPosition(currPos, boardSize)) {
        const targetPiece = board[currPos.row][currPos.col];
        
        if (!targetPiece) {
          moves.push({ ...currPos });
        } else if (targetPiece.color === piece.color) {
          // Can slither through friendly pieces
          currPos = {
            row: currPos.row + rowDir,
            col: currPos.col + colDir
          };
          continue;
        } else {
          // Can capture enemy pieces
          moves.push({ ...currPos });
          break;
        }
        
        currPos = {
          row: currPos.row + rowDir,
          col: currPos.col + colDir
        };
      }
    }
  }
  
  // Shadow Assassin - Can move like a knight but also teleport to any empty square
  else if (pieceType === 'shadow_assassin' || pieceName.includes('shadow') || pieceName.includes('assassin')) {
    console.log('RPG: Shadow Assassin movement - knight-like with teleportation');
    
    // Knight movement
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
    
    // Teleportation ability - can move to any empty square on the board
    for (let row = 0; row < boardSize; row++) {
      for (let col = 0; col < boardSize; col++) {
        if (row === pos.row && col === pos.col) continue; // Can't teleport to current position
        
        const targetPiece = board[row][col];
        if (!targetPiece) {
          moves.push({ row, col });
        }
      }
    }
  }
  
  // Fire Mage - Can move like a rook but also has "fireball" ability (capture from 2 squares away)
  else if (pieceType === 'fire_mage' || pieceName.includes('fire') || pieceName.includes('mage')) {
    console.log('RPG: Fire Mage movement - rook-like with fireball ability');
    
    // Rook movement (horizontal/vertical)
    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
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
            moves.push({ ...currPos }); // Can capture
          }
          break;
        }
        
        currPos = {
          row: currPos.row + rowDir,
          col: currPos.col + colDir
        };
      }
    }
    
    // Fireball ability - can attack from 2 squares away in any direction
    for (let rowOffset = -2; rowOffset <= 2; rowOffset++) {
      for (let colOffset = -2; colOffset <= 2; colOffset++) {
        if (rowOffset === 0 && colOffset === 0) continue;
        if (Math.abs(rowOffset) === 1 && Math.abs(colOffset) === 1) continue; // Skip diagonal 1-square moves (already covered by rook)
        
        const fireballPos = {
          row: pos.row + rowOffset,
          col: pos.col + colOffset
        };
        
        if (isValidPosition(fireballPos, boardSize)) {
          const targetPiece = board[fireballPos.row][fireballPos.col];
          if (targetPiece && targetPiece.color !== piece.color) {
            moves.push(fireballPos);
          }
        }
      }
    }
  }
  
  // Ice Knight - Can move like a knight but also freezes adjacent squares (can move to frozen squares)
  else if (pieceType === 'ice_knight' || pieceName.includes('ice')) {
    console.log('RPG: Ice Knight movement - knight-like with freezing ability');
    
    // Knight movement
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
    
    // Freezing ability - can move to squares adjacent to enemy pieces (freezing them)
    for (let rowOffset = -1; rowOffset <= 1; rowOffset++) {
      for (let colOffset = -1; colOffset <= 1; colOffset++) {
        if (rowOffset === 0 && colOffset === 0) continue;
        
        const adjacentPos = {
          row: pos.row + rowOffset,
          col: pos.col + colOffset
        };
        
        if (isValidPosition(adjacentPos, boardSize)) {
          const targetPiece = board[adjacentPos.row][adjacentPos.col];
          if (targetPiece && targetPiece.color !== piece.color) {
            // Can move to squares adjacent to enemy pieces (freezing them)
            moves.push(adjacentPos);
          }
        }
      }
    }
  }
  
  // Shadow pieces - Can move like their base type but with enhanced abilities
  else if (pieceName.includes('shadow')) {
    console.log('RPG: Shadow piece movement - enhanced base movement');
    
    // Determine base type from name
    if (pieceName.includes('pawn')) {
      // Shadow Pawn - can move like a pawn but also diagonally forward
      const direction = piece.color === "white" ? -1 : 1;
      const startRow = piece.color === "white" ? boardSize - 2 : 1;
      const isInitialPosition = pos.row === startRow;
      
      // Forward moves
      const singleMove = { row: pos.row + direction, col: pos.col };
      if (isValidPosition(singleMove, boardSize) && !board[singleMove.row][singleMove.col]) {
        moves.push(singleMove);
        
        if (isInitialPosition && !piece.hasMoved) {
          const doubleMove = { row: pos.row + 2 * direction, col: pos.col };
          if (isValidPosition(doubleMove, boardSize) && !board[doubleMove.row][doubleMove.col]) {
            moves.push(doubleMove);
          }
        }
      }
      
      // Diagonal moves (shadow ability)
      for (const offsetCol of [-1, 1]) {
        const diagonalMove = {
          row: pos.row + direction,
          col: pos.col + offsetCol
        };
        
        if (isValidPosition(diagonalMove, boardSize)) {
          const targetPiece = board[diagonalMove.row][diagonalMove.col];
          if (!targetPiece || targetPiece.color !== piece.color) {
            moves.push(diagonalMove);
          }
        }
      }
    } else {
      // For other shadow pieces, use their base movement pattern
      return calculateStandardChessMoves(pos, board, currentPlayer, boardSize, piece);
    }
  }
  
  // Default fallback - if no custom pattern matches, use standard movement
  else {
    console.log('RPG: No custom pattern found, using standard movement');
    // Use the standard chess movement patterns directly instead of calling calculateRPGValidMoves
    return calculateStandardChessMoves(pos, board, currentPlayer, boardSize, piece);
  }

  console.log(`RPG Custom moves for ${piece.type} (${pieceName}) at [${pos.row}, ${pos.col}]:`, moves);
  return moves;
};

/** Calculate standard chess moves without custom patterns to avoid recursion */
const calculateStandardChessMoves = (
  pos: BoardPosition,
  board: (Piece | RPGPiece | EnhancedRPGPiece | null)[][],
  currentPlayer: PieceColor,
  boardSize: number,
  piece: Piece | RPGPiece | EnhancedRPGPiece
): BoardPosition[] => {
  const pieceType = piece.type.toLowerCase();
  let moves: BoardPosition[] = [];

  console.log('RPG: Using standard chess movement for:', pieceType);

  switch (pieceType) {
    case "pawn": {
      const direction = piece.color === "white" ? -1 : 1;
      const startRow = piece.color === "white" ? boardSize - 2 : 1;
      const isInitialPosition = pos.row === startRow;

      // Single move forward
      const singleMove = { row: pos.row + direction, col: pos.col };
      if (isValidPosition(singleMove, boardSize) && !board[singleMove.row][singleMove.col]) {
        moves.push(singleMove);

        // Double move from initial position
        if (isInitialPosition && !piece.hasMoved) {
          const doubleMove = { row: pos.row + 2 * direction, col: pos.col };
          if (isValidPosition(doubleMove, boardSize) && !board[doubleMove.row][doubleMove.col]) {
            moves.push(doubleMove);
          }
        }
      }

      // Capture moves (diagonal)
      for (const offsetCol of [-1, 1]) {
        const capturePos = {
          row: pos.row + direction,
          col: pos.col + offsetCol
        };

        if (isValidPosition(capturePos, boardSize)) {
          const targetPiece = board[capturePos.row][capturePos.col];
          if (targetPiece && targetPiece.color !== piece.color) {
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
      break;
    }
    case "rook":
    case "bishop":
    case "queen": {
      const directions = [];

      // Rook and queen can move horizontally/vertically
      if (pieceType === "rook" || pieceType === "queen") {
        directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      }

      // Bishop and queen can move diagonally
      if (pieceType === "bishop" || pieceType === "queen") {
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

  console.log(`RPG Standard moves for ${piece.type} at [${pos.row}, ${pos.col}]:`, moves);
  return moves;
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
