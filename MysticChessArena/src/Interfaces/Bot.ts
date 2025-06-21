export interface Bot {
  id: string;
  name: string;
  points: number;
  description: string;
  avatar?: string;
  difficulty: 'beginner' | 'easy' | 'novice' | 'intermediate' | 'advanced' | 'master';
}

export const bots: Bot[] = [
  {
    id: "rookie",
    name: "Rookie Bot",
    points: 300,
    difficulty: 'beginner',
    description: "Makes frequent mistakes and blunders. Perfect for learning the basics!"
  },
  {
    id: "beginner",
    name: "Beginner Bot",
    points: 400,
    difficulty: 'beginner',
    description: "Still learning chess. Makes obvious mistakes but knows basic rules."
  },
  {
    id: "casual",
    name: "Casual Bot",
    points: 600,
    difficulty: 'easy',
    description: "Plays casually with occasional good moves. Good for new players."
  },
  {
    id: "novice",
    name: "Novice Bot",
    points: 800,
    difficulty: 'novice',
    description: "Understands basic tactics but still makes mistakes."
  },
  {
    id: "amateur",
    name: "Amateur Bot",
    points: 1000,
    difficulty: 'novice',
    description: "Decent player with some tactical awareness."
  },
  {
    id: "intermediate",
    name: "Intermediate Bot",
    points: 1200,
    difficulty: 'intermediate',
    description: "Solid player with good tactical skills."
  },
  {
    id: "advanced",
    name: "Advanced Bot",
    points: 1600,
    difficulty: 'advanced',
    description: "Strong player with excellent tactical and positional understanding."
  },
  {
    id: "expert",
    name: "Expert Bot",
    points: 2000,
    difficulty: 'advanced',
    description: "Very strong player. Prepare for a real challenge!"
  },
  {
    id: "master",
    name: "Master Bot",
    points: 2400,
    difficulty: 'master',
    description: "Master-level play. Only for the most experienced players."
  }
];
