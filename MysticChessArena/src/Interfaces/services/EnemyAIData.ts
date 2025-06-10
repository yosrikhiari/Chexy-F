export interface EnemyAIData {
  gameId: string;
  round: number;
  difficulty: number;
  moveHistory: any[];
  strategy: 'defensive' | 'aggressive' | 'balanced' | 'adaptive';
}
