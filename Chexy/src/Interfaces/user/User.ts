export interface User {
  id: string;
  keycloakId: string;
  username: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  points: number;
  phoneNumber?: string;
  birthdate?: string;
  city?: string;
  image?: string;
  aboutMe?: string;
  role: 'USER' | 'ADMIN';
  playerProfileId?: string;
  isActive: boolean;
  gameStats?: {
    currentStreak: number;
    totalGamesPlayed: number;
    totalGamesWon: number;
    winRate: number;
  };
}
