import { CapacityModifier, RPGGameState, RPGPiece, ArmyCapacity } from "@/Interfaces/types/rpgChess";
import {rpgGameService} from '@/services/RPGGameService.ts';

// Static CAPACITY_MODIFIERS for UI display or fallback
export const CAPACITY_MODIFIERS: CapacityModifier[] = [
  {
    id: 'mercenary-camp',
    name: 'Mercenary Camp',
    description: 'Recruit additional forces. +2 max army size.',
    type: 'total_capacity',
    capacityBonus: 2,
    rarity: 'common',
    isActive: false
  },
  {
    id: 'war-machine',
    name: 'War Machine',
    description: 'Military infrastructure. +4 max army size.',
    type: 'total_capacity',
    capacityBonus: 4,
    rarity: 'rare',
    isActive: false
  },
  {
    id: 'imperial-legion',
    name: 'Imperial Legion',
    description: 'Vast military organization. +6 max army size.',
    type: 'total_capacity',
    capacityBonus: 6,
    rarity: 'epic',
    isActive: false
  },
  {
    id: 'royal-decree',
    name: 'Royal Decree',
    description: 'Grant nobility status. +1 Queen limit.',
    type: 'piece_type_limit',
    pieceType: 'queen',
    capacityBonus: 1,
    rarity: 'legendary',
    isActive: false
  },
  {
    id: 'elite-training',
    name: 'Elite Training - Knights',
    description: 'Advanced cavalry training. +2 Knight limit.',
    type: 'piece_type_limit',
    pieceType: 'knight',
    capacityBonus: 2,
    rarity: 'rare',
    isActive: false
  },
  {
    id: 'fortress-command',
    name: 'Fortress Command',
    description: 'Fortified positions. +2 Rook limit.',
    type: 'piece_type_limit',
    pieceType: 'rook',
    capacityBonus: 2,
    rarity: 'rare',
    isActive: false
  },
  {
    id: 'cathedral-order',
    name: 'Cathedral Order',
    description: 'Religious authority. +2 Bishop limit.',
    type: 'piece_type_limit',
    pieceType: 'bishop',
    capacityBonus: 2,
    rarity: 'rare',
    isActive: false
  },
  {
    id: 'conscription',
    name: 'Conscription',
    description: 'Mass recruitment. +4 Pawn limit.',
    type: 'piece_type_limit',
    pieceType: 'pawn',
    capacityBonus: 4,
    rarity: 'common',
    isActive: false
  },
  {
    id: 'expanded-territory',
    name: 'Expanded Territory',
    description: 'Control larger battlefields. +3 capacity when board ≥ 10x10.',
    type: 'board_synergy',
    capacityBonus: 3,
    rarity: 'rare',
    isActive: false
  },
  {
    id: 'colossal-command',
    name: 'Colossal Command',
    description: 'Master vast armies. +5 capacity when board ≥ 12x12.',
    type: 'board_synergy',
    capacityBonus: 5,
    rarity: 'epic',
    isActive: false
  }
];

// Fetch active capacity modifiers from the backend
export const fetchActiveCapacityModifiers = async (gameId: string): Promise<CapacityModifier[]> => {
  try {
    const gameState = await rpgGameService.getRPGGame(gameId);
    return gameState.activeCapacityModifiers || [];
  } catch (error) {
    console.error("Failed to fetch active capacity modifiers:", error);
    return CAPACITY_MODIFIERS; // Fallback to static list
  }
};

// Apply a capacity modifier via the backend
export const applyCapacityModifier = async (
  gameId: string,
  modifierId: string,
  playerId: string
): Promise<RPGGameState> => {
  try {
    const modifier = CAPACITY_MODIFIERS.find(m => m.id === modifierId);
    if (!modifier) {
      throw new Error(`Modifier with ID ${modifierId} not found`);
    }
    const response = await rpgGameService.addModifier(gameId, modifier, playerId);
    return response;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to apply modifier");
  }
};

// Purchase a capacity modifier from the shop
export const purchaseCapacityModifier = async (
  gameId: string,
  shopItemId: string,
  playerId: string
): Promise<RPGGameState> => {
  try {
    const response = await rpgGameService.purchaseShopItem(gameId, shopItemId, playerId);
    return response;
  } catch (error) {
    throw new Error(error instanceof Error ? error.message : "Failed to purchase modifier");
  }
};

// Modified calculateArmyCapacity to use backend-fetched modifiers
export const calculateArmyCapacity = async (
  gameId: string,
  boardSize: number
): Promise<ArmyCapacity> => {
  const baseCapacity = calculateBaseCapacity(boardSize);
  const baseLimits = getDefaultPieceLimits();

  let totalCapacityBonus = 0;
  let queenBonus = 0;
  let rookBonus = 0;
  let bishopBonus = 0;
  let knightBonus = 0;
  let pawnBonus = 0;

  // Fetch active modifiers from backend
  const activeModifiers = await fetchActiveCapacityModifiers(gameId);

  activeModifiers.forEach(modifier => {
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
        if (
          (modifier.id === 'expanded-territory' && boardSize >= 10) ||
          (modifier.id === 'colossal-command' && boardSize >= 12)
        ) {
          totalCapacityBonus += modifier.capacityBonus;
        }
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

// Helper functions (unchanged)
export const calculateBaseCapacity = (boardSize: number): number => {
  const boardArea = boardSize * boardSize;
  return Math.floor(boardArea / 8);
};

export const getDefaultPieceLimits = (): Omit<ArmyCapacity, 'maxTotalPieces' | 'bonusCapacity'> => ({
  maxQueens: 2,
  maxRooks: 4,
  maxBishops: 4,
  maxKnights: 4,
  maxPawns: 8
});
