import { BoardEffect } from "@/Interfaces/types/rpgChess";
import { TeleportPortal, DynamicBoardModifier } from "@/Interfaces/types/enhancedRpgChess";
import { BoardPosition } from "@/Interfaces/types/chess";
import {rpgGameService} from '@/services/RPGGameService.ts';
import {enhancedRPGService} from '@/services/EnhancedRPGService.ts';
import {undefined} from 'zod';

export const calculateTeleportPortals = (boardSize: number): number => {
  if (boardSize <= 8) return 1;
  if (boardSize <= 10) return 2;
  if (boardSize <= 12) return 3;
  return Math.floor(boardSize / 4);
};

export const generateTeleportPortals = async (
  gameId: string,
  playerId: string,
  boardSize: number,
  count: number
): Promise<TeleportPortal[]> => {
  const portals: TeleportPortal[] = [];
  const usedPositions = new Set<string>();

  for (let i = 0; i < count * 2; i++) {
    let position: BoardPosition;
    let positionKey: string;

    do {
      const row = 2 + Math.floor(Math.random() * (boardSize - 4));
      const col = 2 + Math.floor(Math.random() * (boardSize - 4));
      position = { row, col };
      positionKey = `${row},${col}`;
    } while (usedPositions.has(positionKey));

    usedPositions.add(positionKey);

    const portalId = `portal_${i}`;
    const linkedPortalId = i % 2 === 0 ? `portal_${i + 1}` : `portal_${i - 1}`;

    const portal: TeleportPortal = {
      id: portalId,
      position,
      to: position,
      linkedPortal: linkedPortalId,
      isActive: true,
    };
    portals.push(portal);
  }

  for (let i = 0; i < portals.length; i += 2) {
    portals[i].to = portals[i + 1].position;
    portals[i + 1].to = portals[i].position;
  }

  for (const portal of portals) {
    const payload = {
      id: portal.id,
      name: `Teleport Portal ${portal.id}`,
      description: `Teleports pieces to ${portal.to.row},${portal.to.col}`,
      type: 'teleport',
      positions: [[portal.position.row, portal.position.col]],
      effect: { type: 'teleport', to: portal.to },
      isActive: portal.isActive,
    } as BoardEffect;

    try {
      await rpgGameService.addBoardEffect(gameId, payload, playerId);
    } catch (error) {
      console.warn(`Failed to add portal ${portal.id} to backend:`, error);
      // Continue anyway - portals will work locally
    }
  }

  return portals;
};

export const generateDynamicBoardModifiers = async (
  gameId: string,
  playerId: string,
  currentBoardSize: number,
  currentRound: number,
  activeModifiers: any[]
): Promise<DynamicBoardModifier[]> => {
  const modifiers: DynamicBoardModifier[] = [];

  modifiers.push({
    id: 'expand_small',
    name: 'Minor Expansion',
    description: 'Increases the battlefield by 1 square',
    effect: 'increase_size',
    rarity: 'common',
    sizeModifier: 1,
    isActive: false,
  });

  modifiers.push({
    id: 'expand_medium',
    name: 'Major Expansion',
    description: 'Increases the battlefield by 2 squares',
    effect: 'increase_size',
    rarity: 'rare',
    sizeModifier: 2,
    isActive: false,
  });

  modifiers.push({
    id: 'expand_large',
    name: 'Massive Expansion',
    description: 'Increases the battlefield by 3 squares',
    effect: 'increase_size',
    rarity: 'epic',
    sizeModifier: 3,
    isActive: false,
  });

  if (currentBoardSize > 10) {
    modifiers.push({
      id: 'shrink_small',
      name: 'Minor Contraction',
      description: 'Decreases the battlefield by 1 square',
      effect: 'decrease_size',
      rarity: 'rare',
      sizeModifier: -1,
      minBoardSize: 8,
      isActive: false,
    });

    if (currentBoardSize > 12) {
      modifiers.push({
        id: 'shrink_medium',
        name: 'Major Contraction',
        description: 'Decreases the battlefield by 2 squares',
        effect: 'decrease_size',
        rarity: 'epic',
        sizeModifier: -2,
        minBoardSize: 8,
        isActive: false,
      });
    }
  }

  if (currentRound >= 3) {
    const portalCount = calculateTeleportPortals(currentBoardSize + 2);
    modifiers.push({
      id: 'chaos_portals',
      name: 'Chaos Portals',
      description: `Adds ${portalCount} additional teleport portals`,
      effect: 'add_teleport_tiles',
      rarity: 'epic',
      sizeModifier: 0,
      isActive: false,
    });
  }

  if (currentRound >= 5) {
    modifiers.push({
      id: 'trap_field',
      name: 'Trap Field',
      description: 'Adds dangerous trap tiles across the battlefield',
      effect: 'add_trap_tiles',
      rarity: 'legendary',
      sizeModifier: 0,
      isActive: false,
    });
  }

  const validModifiers = modifiers.filter(modifier => {
    if (modifier.minBoardSize && currentBoardSize <= modifier.minBoardSize) return false;
    if (modifier.maxBoardSize && currentBoardSize >= modifier.maxBoardSize) return false;
    return true;
  });

  return validModifiers;
};



export const calculateProgressiveBoardSize = async (
  gameId: string,
  playerId: string,
  baseSize: number,
  round: number
): Promise<number> => {
  const bossRounds = Math.floor((round - 1) / 5);
  const newBoardSize = Math.min(16, baseSize + bossRounds);

  console.log('Calculating board size:', {
    baseSize,
    round,
    bossRounds,
    newBoardSize
  });

  // Only persist if size actually changes
  if (newBoardSize !== baseSize) {
    const modifier: DynamicBoardModifier = {
      id: `size_update_round_${round}`,
      name: "Progressive Expansion",
      description: `Board expanded to ${newBoardSize}x${newBoardSize}`,
      effect: 'increase_size',
      rarity: 'common',
      sizeModifier: newBoardSize - baseSize,
      isActive: true,
    };

    try {
      console.log('Attempting to apply board size modifier:', modifier);
      await enhancedRPGService.applyBoardEffect(gameId, modifier, playerId);
      console.log('Successfully applied board size modifier');
    } catch (error) {
      console.warn('Failed to persist board size change to backend:', error);
      // Don't throw - continue with local state
      // The parent component will handle the new board size
    }
  }

  return newBoardSize;
};


export const shouldExposeEnemyQueen = async (
  gameId: string,
  playerId: string,
  round: number
): Promise<boolean> => {
  const isBossRound = round % 5 === 0;
  const shouldExpose = isBossRound && round >= 4;

  if (shouldExpose) {
    const payload: BoardEffect = {
      id: `queen_expose_round_${round}`,
      name: "Expose Enemy Queen",
      description: "Reveals the enemy queen's position for this round",
      type: 'expose_queen',
      positions: [],
      effect: { type: 'expose_queen' },
      isActive: true,
    };

    try {
      await rpgGameService.addBoardEffect(gameId, payload, playerId);
    } catch (error) {
      console.warn("Failed to persist queen exposure:", error);
    }
  }

  return shouldExpose;
}
