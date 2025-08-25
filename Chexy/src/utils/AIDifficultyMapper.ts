import { AIStrategy } from "@/Interfaces/enums/AIStrategy";

export interface DifficultyConfig {
  points: number;
  name: string;
  description: string;
  icon: string;
  color: string;
  characteristics: string[];
}

export const AI_DIFFICULTY_MAP: Record<AIStrategy, DifficultyConfig> = {
  // Legacy strategies (mapped to balanced difficulty)
  defensive: {
    points: 800,
    name: "Defensive Sage",
    description: "A cautious strategist who prioritizes defense",
    icon: "🛡️",
    color: "blue",
    characteristics: ["Defensive play", "Cautious moves", "Solid position"]
  },
  aggressive: {
    points: 1200,
    name: "Aggressive Warrior",
    description: "A bold fighter who seeks tactical opportunities",
    icon: "⚔️",
    color: "red",
    characteristics: ["Attacking play", "Tactical combinations", "Active pieces"]
  },
  balanced: {
    points: 1000,
    name: "Balanced Strategist",
    description: "A well-rounded player with mixed approach",
    icon: "⚖️",
    color: "purple",
    characteristics: ["Mixed strategy", "Adaptive play", "Positional understanding"]
  },
  adaptive: {
    points: 1400,
    name: "Adaptive Master",
    description: "A flexible player who adjusts to the position",
    icon: "🔄",
    color: "green",
    characteristics: ["Positional adaptation", "Dynamic play", "Strategic flexibility"]
  },

  // New detailed difficulty levels
  novice: {
    points: 400,
    name: "The Novice Apprentice",
    description: "A young mage learning the ancient arts of chess",
    icon: "🧙‍♂️",
    color: "yellow",
    characteristics: ["Makes many mistakes", "Random moves", "Basic understanding"]
  },
  apprentice: {
    points: 600,
    name: "The Dedicated Student",
    description: "A diligent learner with growing knowledge",
    icon: "📚",
    color: "orange",
    characteristics: ["Frequent mistakes", "Basic tactics", "Learning phase"]
  },
  journeyman: {
    points: 800,
    name: "The Skilled Journeyman",
    description: "A competent player with solid fundamentals",
    icon: "⚒️",
    color: "cyan",
    characteristics: ["Occasional mistakes", "Good fundamentals", "Tactical awareness"]
  },
  expert: {
    points: 1200,
    name: "The Wise Expert",
    description: "A seasoned player with deep understanding",
    icon: "🧙‍♀️",
    color: "blue",
    characteristics: ["Rare mistakes", "Strategic thinking", "Positional play"]
  },
  master: {
    points: 1800,
    name: "The Ancient Master",
    description: "A legendary player with centuries of wisdom",
    icon: "🐉",
    color: "purple",
    characteristics: ["Minimal mistakes", "Advanced strategy", "Deep calculation"]
  },
  grandmaster: {
    points: 2400,
    name: "The Grandmaster",
    description: "A chess deity with unparalleled skill and a fairly long beard",
    icon: "👑",
    color: "gold",
    characteristics: ["Perfect play", "Master-level strategy", "Unbeatable strength"]
  }
};

export function getDifficultyConfig(strategy: AIStrategy): DifficultyConfig {
  return AI_DIFFICULTY_MAP[strategy];
}

export function getDifficultyPoints(strategy: AIStrategy): number {
  return AI_DIFFICULTY_MAP[strategy].points;
}

export function getDifficultyName(strategy: AIStrategy): string {
  return AI_DIFFICULTY_MAP[strategy].name;
}

export function getDifficultyDescription(strategy: AIStrategy): string {
  return AI_DIFFICULTY_MAP[strategy].description;
}

export function getDifficultyIcon(strategy: AIStrategy): string {
  return AI_DIFFICULTY_MAP[strategy].icon;
}

export function getDifficultyColor(strategy: AIStrategy): string {
  return AI_DIFFICULTY_MAP[strategy].color;
}

export function getDifficultyCharacteristics(strategy: AIStrategy): string[] {
  return AI_DIFFICULTY_MAP[strategy].characteristics;
}
