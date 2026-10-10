import type { LocusId, Personality } from '../core/types';

export type AlleleSource = 'common' | 'dwarf' | 'elf';

export interface AlleleDef {
  id: string;
  locus: LocusId;
  name: string;
  source: AlleleSource;
  rank: number;
  dormantAtBirth?: boolean;
  slots?: number;
  hp?: number;
  def?: number;
  arm?: number;
  mov?: number;
  eva?: number;
  spd?: number;
  delayResist?: boolean;
  skill?: string;
  personality?: Personality;
  devotionMul?: number;
  suspicionMul?: number;
  atkMul?: number;
  agingStart?: number;
}

export const LOCUS_NAMES: Record<LocusId, string> = {
  L1: '灵魂承载',
  L2: '骨骼肌理',
  L3: '体液神经',
  L4: '器官特化',
  L5: '心智倾向',
  L6: '端粒寿命',
};

/** Used when every allele on a locus is dormant. */
export const LOCUS_DEFAULT: Record<LocusId, string> = {
  L1: 'mundane',
  L2: 'balanced',
  L3: 'normalSpeed',
  L4: 'fang',
  L5: 'docile',
  L6: 'normalLife',
};

export const ALLELES: AlleleDef[] = [
  // L1 soul capacity
  { id: 'mundane', locus: 'L1', name: '凡庸', source: 'common', rank: 2, slots: 2 },
  { id: 'wide', locus: 'L1', name: '宽域', source: 'common', rank: 1, slots: 3 },
  { id: 'neuralWeb', locus: 'L1', name: '神经织网', source: 'elf', rank: 3, dormantAtBirth: true, slots: 4 },
  // L2 frame
  { id: 'balanced', locus: 'L2', name: '均衡', source: 'common', rank: 2, hp: 100, def: 10, arm: 30, mov: 3, eva: 0.05 },
  { id: 'shadow', locus: 'L2', name: '幽影之躯', source: 'common', rank: 1, hp: 80, def: 5, arm: 20, mov: 4, eva: 0.2 },
  { id: 'dwarfBone', locus: 'L2', name: '矮人重骨', source: 'dwarf', rank: 3, hp: 130, def: 18, arm: 50, mov: 2, eva: 0 },
  // L3 nerves
  { id: 'normalSpeed', locus: 'L3', name: '常速', source: 'common', rank: 2, spd: 100 },
  { id: 'swift', locus: 'L3', name: '迅捷', source: 'common', rank: 1, spd: 120 },
  { id: 'steady', locus: 'L3', name: '沉稳', source: 'dwarf', rank: 2, spd: 85, delayResist: true },
  { id: 'elfSpeed', locus: 'L3', name: '灵速', source: 'elf', rank: 1, spd: 135 },
  // L4 organ
  { id: 'fang', locus: 'L4', name: '獠牙', source: 'common', rank: 2, skill: 'bite' },
  { id: 'ram', locus: 'L4', name: '冲撞肌', source: 'common', rank: 1, skill: 'ram' },
  { id: 'acid', locus: 'L4', name: '碎甲腺', source: 'common', rank: 1, skill: 'acid' },
  { id: 'forgeArm', locus: 'L4', name: '锻臂', source: 'dwarf', rank: 3, skill: 'shieldBash' },
  { id: 'lightSense', locus: 'L4', name: '光感', source: 'elf', rank: 2, skill: 'markShot' },
  // L5 mind
  { id: 'docile', locus: 'L5', name: '迟钝', source: 'common', rank: 3, personality: 'docile', devotionMul: 0.7, suspicionMul: 0.5 },
  { id: 'paranoid', locus: 'L5', name: '多疑', source: 'common', rank: 2, personality: 'paranoid', devotionMul: 0.8, suspicionMul: 1.5, atkMul: 1.1 },
  { id: 'zealot', locus: 'L5', name: '狂信', source: 'common', rank: 1, personality: 'zealot', devotionMul: 1.5, suspicionMul: 0.8 },
  // L6 telomere
  { id: 'normalLife', locus: 'L6', name: '常寿', source: 'common', rank: 2, agingStart: 36 },
  { id: 'longevity', locus: 'L6', name: '长寿', source: 'common', rank: 1, agingStart: 48 },
  { id: 'burn', locus: 'L6', name: '燃命', source: 'common', rank: 1, agingStart: 24, atkMul: 1.2 },
  { id: 'evergreen', locus: 'L6', name: '永春', source: 'elf', rank: 1, dormantAtBirth: true, agingStart: 60 },
];

export const ALLELE_MAP: Record<string, AlleleDef> = Object.fromEntries(ALLELES.map((a) => [a.id, a]));

export function allelesOf(locus: LocusId, source?: AlleleSource): AlleleDef[] {
  return ALLELES.filter((a) => a.locus === locus && (source === undefined || a.source === source));
}

export const PERSONALITY_NAMES: Record<Personality, string> = {
  docile: '迟钝',
  zealot: '狂信',
  paranoid: '多疑',
};
