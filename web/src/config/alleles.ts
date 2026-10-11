import type { LocusId, Personality } from '../core/types';

export type AlleleSource = 'common' | 'dwarf' | 'elf';

/** Additive modifiers on top of the base stat template. `*Pct` entries are summed, then applied once. */
export interface StatMods {
  hp?: number;
  atk?: number;
  def?: number;
  arm?: number;
  spd?: number;
  mov?: number;
  eva?: number;
  hpPct?: number;
  atkPct?: number;
}

export const STAT_MOD_KEYS: (keyof StatMods)[] = ['hp', 'atk', 'def', 'arm', 'spd', 'mov', 'eva', 'hpPct', 'atkPct'];

/**
 * Every allele carries one gene passive, id `gene.<alleleId>`.
 * Combat mechanics of gene passives are looked up by that id in the battle rules.
 */
export interface AlleleDef {
  id: string;
  locus: LocusId;
  name: string;
  source: AlleleSource;
  rank: number;
  dormantAtBirth?: boolean;
  desc: string;
  mods?: StatMods;
  slots?: number;
  personality?: Personality;
  devotionMul?: number;
  suspicionMul?: number;
  agingStart?: number;
}

export const genePassiveId = (alleleId: string) => `gene.${alleleId}`;

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
  { id: 'mundane', locus: 'L1', name: '凡庸', source: 'common', rank: 2, slots: 2, desc: '记忆槽 2' },
  { id: 'wide', locus: 'L1', name: '宽域', source: 'common', rank: 1, slots: 3, desc: '记忆槽 3' },
  { id: 'neuralWeb', locus: 'L1', name: '神经织网', source: 'elf', rank: 3, dormantAtBirth: true, slots: 4, desc: '记忆槽 4' },
  // L2 frame
  { id: 'balanced', locus: 'L2', name: '均衡', source: 'common', rank: 2, mods: {}, desc: '体格无修正' },
  {
    id: 'shadow',
    locus: 'L2',
    name: '幽影之躯',
    source: 'common',
    rank: 1,
    mods: { hp: -20, def: -5, arm: -10, mov: 1, eva: 0.15 },
    desc: 'HP −20，DEF −5，ARM −10，MOV +1，EVA +15%',
  },
  {
    id: 'dwarfBone',
    locus: 'L2',
    name: '矮人重骨',
    source: 'dwarf',
    rank: 3,
    mods: { hp: 30, def: 8, arm: 20, mov: -1, eva: -0.05 },
    desc: 'HP +30，DEF +8，ARM +20，MOV −1，EVA −5%',
  },
  // L3 nerves
  { id: 'normalSpeed', locus: 'L3', name: '常速', source: 'common', rank: 2, mods: {}, desc: '速度无修正' },
  { id: 'swift', locus: 'L3', name: '迅捷', source: 'common', rank: 1, mods: { spd: 20 }, desc: 'SPD +20' },
  { id: 'steady', locus: 'L3', name: '沉稳', source: 'dwarf', rank: 2, mods: { spd: -15 }, desc: 'SPD −15；受到的 Delay 减半' },
  { id: 'elfSpeed', locus: 'L3', name: '灵速', source: 'elf', rank: 1, mods: { spd: 35 }, desc: 'SPD +35' },
  // L4 organ: mechanics that amplify a class playstyle
  { id: 'fang', locus: 'L4', name: '獠牙', source: 'common', rank: 2, desc: '近战攻击造成伤害的 15% 转为自身回复' },
  { id: 'ram', locus: 'L4', name: '冲撞肌', source: 'common', rank: 1, desc: '自身技能的击退距离 +1' },
  { id: 'acid', locus: 'L4', name: '碎甲腺', source: 'common', rank: 1, desc: '自身攻击的破甲值 +40%' },
  { id: 'forgeArm', locus: 'L4', name: '锻臂', source: 'dwarf', rank: 3, mods: { def: 5 }, desc: 'DEF +5；自身被击退的距离 −1' },
  { id: 'lightSense', locus: 'L4', name: '光感', source: 'elf', rank: 2, desc: '射线类技能射程 +1' },
  // L5 mind
  {
    id: 'docile',
    locus: 'L5',
    name: '迟钝',
    source: 'common',
    rank: 3,
    personality: 'docile',
    devotionMul: 0.7,
    suspicionMul: 0.5,
    desc: '性格迟钝；狂信增长 x0.7，疑心增长 x0.5',
  },
  {
    id: 'paranoid',
    locus: 'L5',
    name: '多疑',
    source: 'common',
    rank: 2,
    personality: 'paranoid',
    devotionMul: 0.8,
    suspicionMul: 1.5,
    mods: { atkPct: 0.1 },
    desc: '性格多疑；狂信增长 x0.8，疑心增长 x1.5；ATK +10%',
  },
  {
    id: 'zealot',
    locus: 'L5',
    name: '狂信',
    source: 'common',
    rank: 1,
    personality: 'zealot',
    devotionMul: 1.5,
    suspicionMul: 0.8,
    desc: '性格狂信；狂信增长 x1.5，疑心增长 x0.8',
  },
  // L6 telomere
  { id: 'normalLife', locus: 'L6', name: '常寿', source: 'common', rank: 2, agingStart: 36, desc: '36 月起衰老' },
  { id: 'longevity', locus: 'L6', name: '长寿', source: 'common', rank: 1, agingStart: 48, desc: '48 月起衰老' },
  { id: 'burn', locus: 'L6', name: '燃命', source: 'common', rank: 1, agingStart: 24, mods: { atkPct: 0.2 }, desc: '24 月起衰老；ATK +20%' },
  { id: 'evergreen', locus: 'L6', name: '永春', source: 'elf', rank: 1, dormantAtBirth: true, agingStart: 60, desc: '60 月起衰老' },
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
