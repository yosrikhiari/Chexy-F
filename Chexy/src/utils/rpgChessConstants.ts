import { RPGPiece, RPGModifier, RPGBoss } from "@/Interfaces/types/rpgChess";

export const STARTER_PIECES: RPGPiece[] = [
  {
    id: "basic_pawn_1",
    type: "pawn",
    color: "white",
    name: "Brave Pawn",
    description: "A courageous foot soldier ready for battle",
    hp: 2,
    maxHp: 2,
    attack: 1,
    defense: 1,
    rarity: "common",
    specialAbility: "",
    isJoker: false,
    position: undefined,
    hasMoved: false
  },
  {
    id: "basic_pawn_2",
    type: "pawn",
    color: "white",
    name: "Shield Pawn",
    description: "A defensive pawn with extra protection",
    hp: 3,
    maxHp: 3,
    attack: 1,
    defense: 2,
    rarity: "common",
    specialAbility: "",
    isJoker: false,
    position: undefined,
    hasMoved: false
  },
  {
    id: "basic_rook_1",
    type: "rook",
    color: "white",
    name: "Castle Guardian",
    description: "A sturdy defender of the realm",
    hp: 4,
    maxHp: 4,
    attack: 3,
    defense: 2,
    rarity: "common",
    specialAbility: "",
    isJoker: false,
    position: undefined,
    hasMoved: false
  },
  {
    id: "basic_knight_1",
    type: "knight",
    color: "white",
    name: "Swift Knight",
    description: "A nimble warrior with tactical prowess",
    hp: 3,
    maxHp: 3,
    attack: 2,
    defense: 1,
    rarity: "common",
    specialAbility: "",
    isJoker: false,
    position: undefined,
    hasMoved: false
  }
];

export const JOKER_PIECES: RPGPiece[] = [
  {
    id: "gambit_knight",
    type: "knight",
    color: "white",
    name: "Gambit Knight",
    description: "Sacrifice this piece to spawn two pawns",
    specialAbility: "On capture: Spawn 2 Brave Pawns",
    hp: 2,
    maxHp: 2,
    attack: 2,
    defense: 1,
    rarity: "rare",
    isJoker: true,
    position: undefined,
    hasMoved: false
  },
  {
    id: "vampire_queen",
    type: "queen",
    color: "white",
    name: "Vampire Queen",
    description: "Heals after capturing enemy pieces",
    specialAbility: "After capturing: Heal 1 HP",
    hp: 5,
    maxHp: 6,
    attack: 4,
    defense: 2,
    rarity: "epic",
    isJoker: true,
    position: undefined,
    hasMoved: false
  },
  {
    id: "phoenix_bishop",
    type: "bishop",
    color: "white",
    name: "Phoenix Bishop",
    description: "Revives once when captured",
    specialAbility: "Revive once with 1 HP when captured",
    hp: 3,
    maxHp: 3,
    attack: 2,
    defense: 1,
    rarity: "rare",
    isJoker: true,
    position: undefined,
    hasMoved: false
  }
];

export const RPG_MODIFIERS: RPGModifier[] = [
  {
    id: "pawn_storm",
    name: "Pawn Storm",
    description: "All pawns move like queens when promoted",
    effect: "pawn_promotion_boost",
    rarity: "epic",
    isActive: false
  },
  {
    id: "castle_bomb",
    name: "Castle Bomb",
    description: "Rooks explode, damaging adjacent enemies when captured",
    effect: "rook_explosion",
    rarity: "rare",
    isActive: false
  },
  {
    id: "knight_leap",
    name: "Knight's Leap",
    description: "Knights can move twice per turn",
    effect: "knight_double_move",
    rarity: "rare",
    isActive: false
  },
  {
    id: "royal_guard",
    name: "Royal Guard",
    description: "King gains +2 defense and can't be checked for 3 turns",
    effect: "king_immunity",
    rarity: "legendary",
    isActive: false
  },
  {
    id: "gold_multiplier",
    name: "Gold Multiplier",
    description: "Increase gold gained each round by 10% per card owned.",
    effect: "gold_multiplier",
    rarity: "rare",
    isActive: false
  }
];

export const RPG_BOSSES: RPGBoss[] = [
  {
    id: "swarm_king",
    name: "The Swarm King",
    description: "A dark monarch commanding endless hordes",
    hp: 8,
    maxHp: 8,
    specialAbility: "Spawns 2 shadow pawns every 3 turns",
    gimmick: "Infinite pawn spawning",
    pieces: [
      {
        id: "shadow_pawn_1",
        type: "pawn",
        color: "black",
        name: "Shadow Pawn",
        description: "A creature of darkness",
        hp: 1,
        maxHp: 1,
        attack: 1,
        defense: 0,
        rarity: "common",
        specialAbility: "",
        isJoker: false,
        position: undefined,
        hasMoved: false
      }
    ]
  },
  {
    id: "immortal_queen",
    name: "The Immortal Queen",
    description: "A fallen ruler who refuses to stay dead",
    hp: 6,
    maxHp: 6,
    specialAbility: "Revives once after being captured",
    gimmick: "Resurrection ability",
    pieces: [
      {
        id: "cursed_knight_1",
        type: "knight",
        color: "black",
        name: "Cursed Knight",
        description: "A knight bound to eternal service",
        hp: 3,
        maxHp: 3,
        attack: 2,
        defense: 1,
        rarity: "rare",
        specialAbility: "",
        isJoker: false,
        position: undefined,
        hasMoved: false
      }
    ]
  }
];

export const BOARD_SIZES = {
  SMALL: 6,
  MEDIUM: 7,
  LARGE: 8
};

export const ROUND_OBJECTIVES = [
  { type: 'checkmate', description: 'Defeat the enemy king' },
  { type: 'survive', description: 'Survive for {turns} turns' },
  { type: 'capture_key', description: 'Capture the enemy queen' },
  { type: 'boss_fight', description: 'Defeat the boss' }
];
