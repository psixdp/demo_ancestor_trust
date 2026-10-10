import type { AiType } from '../core/types';

export interface EnemyDef {
  id: string;
  name: string;
  short: string;
  aiType: AiType;
  hp: number;
  atk: number;
  def: number;
  arm: number;
  spd: number;
  mov: number;
  eva: number;
  skills: string[];
  isBoss?: boolean;
}

export const ENEMIES: Record<string, EnemyDef> = {
  rat: { id: 'rat', name: '腐化鼠群', short: '鼠', aiType: 'beast', hp: 40, atk: 12, def: 2, arm: 10, spd: 130, mov: 4, eva: 0.1, skills: ['basic'] },
  apprentice: { id: 'apprentice', name: '猎魔人学徒', short: '徒', aiType: 'hunter', hp: 90, atk: 20, def: 8, arm: 30, spd: 100, mov: 3, eva: 0.05, skills: ['basic'] },
  gunner: { id: 'gunner', name: '银弹射手', short: '射', aiType: 'hunter', hp: 60, atk: 22, def: 4, arm: 20, spd: 95, mov: 3, eva: 0.05, skills: ['gunShot'] },
  shield: { id: 'shield', name: '圣铁重盾兵', short: '盾', aiType: 'shield', hp: 150, atk: 18, def: 16, arm: 60, spd: 75, mov: 2, eva: 0, skills: ['basic', 'enemyBash'] },
  boss: { id: 'boss', name: '审判官·格雷', short: '审', aiType: 'boss', hp: 400, atk: 28, def: 14, arm: 100, spd: 105, mov: 3, eva: 0, skills: ['basic'], isBoss: true },
};

/** Each floor lists possible enemy groups; numbers in a tuple are [min, max] counts. */
export const ENCOUNTERS: Record<number, [string, number, number][][]> = {
  1: [[['rat', 2, 2], ['apprentice', 1, 2]]],
  2: [
    [['apprentice', 2, 2], ['gunner', 1, 1], ['rat', 1, 2]],
    [['apprentice', 1, 1], ['shield', 1, 1], ['rat', 2, 2]],
  ],
  3: [[['apprentice', 1, 1], ['gunner', 2, 2], ['shield', 1, 1], ['rat', 1, 1]]],
  4: [[['boss', 1, 1], ['apprentice', 1, 1], ['shield', 1, 1]]],
};

export const LOOT: Record<number, { gold: [number, number]; mutagenChance: number; mutagen: number }> = {
  1: { gold: [80, 120], mutagenChance: 0, mutagen: 0 },
  2: { gold: [100, 150], mutagenChance: 0.5, mutagen: 1 },
  3: { gold: [120, 180], mutagenChance: 1, mutagen: 1 },
  4: { gold: [500, 500], mutagenChance: 1, mutagen: 2 },
};

/** Obstacle layouts for an 8x8 board. Rows 0-1 (enemy spawn) and 6-7 (ally spawn) are kept clear. */
export const LAYOUTS: [number, number][][] = [
  [[2, 3], [5, 3], [2, 4], [5, 4]],
  [[3, 2], [4, 2], [1, 4], [6, 4]],
  [[1, 3], [2, 3], [5, 4], [6, 4]],
  [[3, 3], [4, 4], [0, 5], [7, 2]],
  [[2, 2], [5, 2], [3, 5], [4, 5]],
  [[1, 2], [6, 2], [3, 4], [4, 4], [3, 3]],
  [[0, 3], [1, 3], [6, 3], [7, 3]],
  [[2, 4], [3, 4], [4, 3], [5, 3]],
];
