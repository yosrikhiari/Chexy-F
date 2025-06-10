import { PieceType } from "@/Interfaces/types/chess";
import {RPGPiece, ArmyCapacity, CapacityModifier, RPGGameState} from "@/Interfaces/types/rpgChess";
import {rpgGameService} from '@/services/RPGGameService.ts';

export const calculateBaseCapacity = (boardSize: number): number => {
  const boardArea = boardSize * boardSize;
  return Math.floor(boardArea / 8); // Base formula: Board Area ÷ 8
};

export const getDefaultPieceLimits = (): Omit<ArmyCapacity, 'maxTotalPieces' | 'bonusCapacity'> => ({
  maxQueens: 2,
  maxRooks: 4,
  maxBishops: 4,
  maxKnights: 4,
  maxPawns: 8
});

export const calculateArmyCapacity = (
  boardSize: number,
  capacityModifiers: CapacityModifier[]
): ArmyCapacity => {
  const baseCapacity = calculateBaseCapacity(boardSize);
  const baseLimits = getDefaultPieceLimits();

  let totalCapacityBonus = 0;
  let queenBonus = 0;
  let rookBonus = 0;
  let bishopBonus = 0;
  let knightBonus = 0;
  let pawnBonus = 0;

  capacityModifiers.forEach(modifier => {
    if (!modifier.isActive) return;

    switch (modifier.type) {
      case 'total_capacity':
        totalCapacityBonus += modifier.capacityBonus;
        break;
      case 'piece_type_limit':
        switch (modifier.pieceType) {
          case 'queen':
            queenBonus += modifier.capacityBonus;
            break;
          case 'rook':
            rookBonus += modifier.capacityBonus;
            break;
          case 'bishop':
            bishopBonus += modifier.capacityBonus;
            break;
          case 'knight':
            knightBonus += modifier.capacityBonus;
            break;
          case 'pawn':
            pawnBonus += modifier.capacityBonus;
            break;
        }
        break;
      case 'board_synergy':
        totalCapacityBonus += modifier.capacityBonus;
        break;
    }
  });

  return {
    maxTotalPieces: baseCapacity + totalCapacityBonus,
    maxQueens: baseLimits.maxQueens + queenBonus,
    maxRooks: baseLimits.maxRooks + rookBonus,
    maxBishops: baseLimits.maxBishops + bishopBonus,
    maxKnights: baseLimits.maxKnights + knightBonus,
    maxPawns: baseLimits.maxPawns + pawnBonus,
    bonusCapacity: totalCapacityBonus
  };
};

// Updated canAddPieceToArmy to integrate with RPGGameService
export const canAddPieceToArmy = async (
  army: RPGPiece[],
  newPiece: RPGPiece,
  capacity: ArmyCapacity,
  gameId: string,
  playerId: string
): Promise<{ canAdd: boolean; reason?: string; gameState?: RPGGameState }> => {
  // Client-side validation
  if (army.length >= capacity.maxTotalPieces) {
    return {
      canAdd: false,
      reason: `Army at maximum capacity (${capacity.maxTotalPieces} pieces)`
    };
  }

  // Count pieces by type
  const pieceCounts = army.reduce((counts, piece) => {
    counts[piece.type] = (counts[piece.type] || 0) + 1;
    return counts;
  }, {} as Record<PieceType, number>);

  // Check piece type limits
  const currentCount = pieceCounts[newPiece.type] || 0;

  switch (newPiece.type) {
    case 'queen':
      if (currentCount >= capacity.maxQueens) {
        return { canAdd: false, reason: `Maximum ${capacity.maxQueens} Queens allowed` };
      }
      break;
    case 'rook':
      if (currentCount >= capacity.maxRooks) {
        return { canAdd: false, reason: `Maximum ${capacity.maxRooks} Rooks allowed` };
      }
      break;
    case 'bishop':
      if (currentCount >= capacity.maxBishops) {
        return { canAdd: false, reason: `Maximum ${capacity.maxBishops} Bishops allowed` };
      }
      break;
    case 'knight':
      if (currentCount >= capacity.maxKnights) {
        return { canAdd: false, reason: `Maximum ${capacity.maxKnights} Knights allowed` };
      }
      break;
    case 'pawn':
      if (currentCount >= capacity.maxPawns) {
        return { canAdd: false, reason: `Maximum ${capacity.maxPawns} Pawns allowed` };
      }
      break;
  }

  // If client-side validation passes, attempt to add the piece via backend
  try {
    const updatedGameState = await rpgGameService.addPieceToArmy(gameId, newPiece, playerId);
    return {
      canAdd: true,
      gameState: updatedGameState // Return updated game state for frontend to sync
    };
  } catch (error) {
    return {
      canAdd: false,
      reason: error instanceof Error ? error.message : "Failed to add piece to army"
    };
  }
};

export const getArmyStats = (army: RPGPiece[]) => {
  const pieceCounts = army.reduce((counts, piece) => {
    counts[piece.type] = (counts[piece.type] || 0) + 1;
    return counts;
  }, {} as Record<PieceType, number>);

  return {
    total: army.length,
    queens: pieceCounts.queen || 0,
    rooks: pieceCounts.rook || 0,
    bishops: pieceCounts.bishop || 0,
    knights: pieceCounts.knight || 0,
    pawns: pieceCounts.pawn || 0,
    kings: pieceCounts.king || 0
  };
};
