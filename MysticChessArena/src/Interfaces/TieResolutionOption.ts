import React from 'react';

export interface TieResolutionOption {
  id: string;
  name: string;
  flavor: string;
  description: string;
  weight: number;
  range: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}
