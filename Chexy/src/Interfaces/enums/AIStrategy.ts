export type AIStrategy =
  // Basic strategies (for backward compatibility)
  'defensive' |
  'aggressive' |
  'balanced' |
  'adaptive' |
  
  // Detailed difficulty levels (mapped to Stockfish points)
  'novice' |        // 400 points - Very weak, makes many mistakes
  'apprentice' |    // 600 points - Beginner level
  'journeyman' |    // 800 points - Intermediate level  
  'expert' |        // 1200 points - Advanced level
  'master' |        // 1800 points - Expert level
  'grandmaster';    // 2400+ points - Master level
