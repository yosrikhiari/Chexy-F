export interface Bot {
  id: string; // Unique identifier for the bot
  name: string; // Bot's name (e.g., "Beginner Bot")
  points: number; // Difficulty level in points (e.g., 400, 1200, 2800)
  description: string; // Short description of the bot's playstyle
}


export const bots: Bot[] = [
  {
    id: "bot_beginner",
    name: "Beginner Bot",
    points: 400,
    description: "Perfect for new players, makes simple moves and occasional blunders.",
  },
  {
    id: "bot_novice",
    name: "Novice Bot",
    points: 800,
    description: "Knows basic tactics, suitable for casual players.",
  },
  {
    id: "bot_intermediate",
    name: "Intermediate Bot",
    points: 1200,
    description: "Plays solid chess with occasional tactical tricks.",
  },
  {
    id: "bot_advanced",
    name: "Advanced Bot",
    points: 1800,
    description: "A tough opponent with strong positional and tactical skills.",
  },
  {
    id: "bot_master",
    name: "Master Bot",
    points: 2400,
    description: "Grandmaster-level play, powered by a sophisticated MML model.",
  },
];
