export type Player = 'player' | 'ai';

export type PieceType = 'OU' | 'GY' | 'HI' | 'KA' | 'KI' | 'GI' | 'KE' | 'KY' | 'FU' | 'RY' | 'UM' | 'NG' | 'NK' | 'NY' | 'TO';

export interface Piece {
  id: string; // 一意の識別子
  type: PieceType;
  owner: Player;
  isPromoted: boolean;
}

export type Board = (Piece | null)[][]; // 9x9

export type GameStatus = 'title' | 'playing' | 'victory' | 'defeat' | 'draw';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'pro';

export interface Move {
  from: { r: number; c: number } | null; // null の場合は持ち駒（再配置）から打つ
  to: { r: number; c: number };
  piece: Piece;
  promote?: boolean;
}
