import { BoardEffect, RPGBoardModifier } from "@/Interfaces/types/rpgChess";
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
    // Generate unique position
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
      to: position, // Will be updated after pairing
      linkedPortal: linkedPortalId,
      isActive: true,
    };
    portals.push(portal);
  }

  // Pair portals by updating 'to' field
  for (let i = 0; i < portals.length; i += 2) {
    portals[i].to = portals[i + 1].position;
    portals[i + 1].to = portals[i].position;
  }

  // Persist portals as BoardEffects to the backend
  for (const portal of portals) {
    const boardEffect: BoardEffect = {
      id: portal.id,
      name: `Teleport Portal ${portal.id}`,
      description: `Teleports pieces to ${portal.to.row},${portal.to.col}`,
      type: 'portal',
      positions: [[portal.position.row, portal.position.col]],
      effect: { to: [portal.to.row, portal.to.col] },
      isActive: portal.isActive,
    };

    try {
      await rpgGameService.addBoardEffect(gameId, boardEffect, playerId);
    } catch (error) {
      console.error(`Failed to add portal ${portal.id}:`, error);
      throw new Error(`Failed to persist portal ${portal.id}`);
    }
  }

  return portals;
};

export const generateDynamicBoardModifiers = async (
  gameId: string,
  playerId: string,
  currentBoardSize: number,
  currentRound: number
): Promise<DynamicBoardModifier[]> => {
  const modifiers: DynamicBoardModifier[] = [];

  // Size increase modifiers
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

  // Size decrease modifiers
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

  // Special effects based on round progression
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

  // Filter based on constraints
  const validModifiers = modifiers.filter(modifier => {
    if (modifier.minBoardSize && currentBoardSize <= modifier.minBoardSize) return false;
    if (modifier.maxBoardSize && currentBoardSize >= modifier.maxBoardSize) return false;
    return true;
  });

  // Persist modifiers to backend
  for (const modifier of validModifiers) {
    try {
      if (modifier.effect === 'add_teleport_tiles') {
        const portalCount = calculateTeleportPortals(currentBoardSize + 2);
        await generateTeleportPortals(gameId, playerId, currentBoardSize, portalCount);
      } else if (modifier.effect === 'add_trap_tiles') {
        const trapEffect: BoardEffect = {
          effect: undefined,
          id: modifier.id,
          name: modifier.name,
          description: modifier.description,
          type: 'trap',
          isActive: modifier.isActive,
          positions: [] // Backend should generate trap positions
        };
        await rpgGameService.addBoardEffect(gameId, trapEffect, playerId);
      } else {
        // Size modifiers go to EnhancedRPGService
        await enhancedRPGService.applyBoardEffect(gameId, modifier, playerId);
      }
    } catch (error) {
      console.error(`Failed to apply modifier ${modifier.id}:`, error);
      throw new Error(`Failed to persist modifier ${modifier.id}`);
    }
  }

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

  // Fetch current game state to validate
  try {
    const gameState = await rpgGameService.getRPGGame(gameId);
    if (gameState.boardSize !== baseSize) {
      console.warn("Base board size mismatch. Using backend value:", gameState.boardSize);
      baseSize = gameState.boardSize;
    }
  } catch (error) {
    console.error("Failed to fetch game state:", error);
    throw new Error("Unable to validate board size");
  }

  // If board size changes, persist it
  if (newBoardSize !== baseSize) {
    const modifier: DynamicBoardModifier = {
      id: `size_update_round_${round}`,
      name: "Progressive Expansion",
      description: `Adjusts board size to ${newBoardSize}x${newBoardSize} for round ${round}`,
      effect: 'increase_size',
      rarity: 'common',
      sizeModifier: newBoardSize - baseSize,
      isActive: true,
    };

    try {
      await enhancedRPGService.applyBoardEffect(gameId, modifier, playerId);
    } catch (error) {
      console.error("Failed to update board size:", error);
      throw new Error("Failed to persist board size change");
    }
  }

  return newBoardSize;
};


export const shouldExposeEnemyQueen = async (
  gameId: string,
  playerId: string,
  round: number
): Promise<boolean> => {
  try {
    const gameState = await rpgGameService.getRPGGame(gameId);
    const isBossRound = gameState.currentRound % 5 === 0; // Example logic for boss round
    const shouldExpose = isBossRound && round >= 4;

    if (shouldExpose) {
      const effect = {
        id: `queen_expose_round_${round}`,
        name: "Expose Enemy Queen",
        description: "Exposes the enemy queen for this round",
        effect: "expose_queen",
        rarity: "epic",
        isActive: true,
      };

      await enhancedRPGService.applyBoardEffect(gameId, effect, playerId);
    }

    return shouldExpose;
  } catch (error) {
    console.error("Failed to check queen exposure:", error);
    throw new Error("Unable to determine queen exposure");
  }
};
