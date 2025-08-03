// src/app/models/user-profile.model.ts
export interface UserProfile {
    id: number;
    username: string;
    emailAddress: string;
    imageUrl?: string;
    createdAt?: Date | string;
    points?: number;
  }
