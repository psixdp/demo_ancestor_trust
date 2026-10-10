import type { ExpKey } from '../core/types';

export type MemoryCategory = 'combat' | 'business' | 'psyche';
export type MemorySource = 'xp' | 'desperation' | 'experience' | 'awaken' | 'shadow';

export interface MemoryDef {
  id: string;
  name: string;
  kind: 'active' | 'passive';
  category: MemoryCategory;
  source: MemorySource;
  /** xp unlock cost (source === 'xp') */
  cost?: number;
  /** active memories map to a skill */
  skill?: string;
  desc: string;
}

const list: MemoryDef[] = [
  // xp unlocks
  { id: 'sweep', name: '血刃横扫', kind: 'active', category: 'combat', source: 'xp', cost: 0, skill: 'sweep', desc: '前方及左右共 3 格，倍率 0.8，破甲 15' },
  { id: 'dash', name: '穿刺突进', kind: 'active', category: 'combat', source: 'xp', cost: 0, skill: 'dash', desc: '直线前冲至多 2 格后攻击，倍率 1.3' },
  { id: 'chain', name: '血之锁链', kind: 'active', category: 'combat', source: 'xp', cost: 40, skill: 'chain', desc: '直线射程 3，拉到身边，Delay 25%' },
  { id: 'blink', name: '夜幕步', kind: 'active', category: 'combat', source: 'xp', cost: 40, skill: 'blink', desc: '瞬移（视为移动），下次攻击 +30%' },
  { id: 'orderFocus', name: '号令·集火', kind: 'active', category: 'combat', source: 'xp', cost: 60, skill: 'orderFocus', desc: '子嗣下次行动对该目标的攻击/破势 x2.0' },
  { id: 'orderHold', name: '号令·死守', kind: 'active', category: 'combat', source: 'xp', cost: 60, skill: 'orderHold', desc: '子嗣下次受伤 −30%，护驾 x1.5' },
  { id: 'execMastery', name: '处决精通', kind: 'passive', category: 'combat', source: 'xp', cost: 80, desc: '处决伤害 +30%' },
  { id: 'bloodBody', name: '血族体质', kind: 'passive', category: 'combat', source: 'xp', cost: 80, desc: '每次行动开始回复 3% 最大生命' },
  // patriarch desperation
  { id: 'bloodRage', name: '濒死血怒', kind: 'passive', category: 'combat', source: 'desperation', desc: 'HP < 30% 时 ATK +30%' },
  { id: 'traumaResist', name: '创伤抗性', kind: 'passive', category: 'combat', source: 'desperation', desc: 'HP < 50% 时受到伤害 −15%' },
  { id: 'tailCut', name: '断尾求生', kind: 'passive', category: 'combat', source: 'desperation', desc: 'HP < 25% 时 MOV +2' },
  { id: 'bloodDebt', name: '血债血偿', kind: 'passive', category: 'combat', source: 'desperation', desc: '处决伤害 +25%' },
  // experience traits
  { id: 'selfShield', name: '舍身之盾', kind: 'passive', category: 'combat', source: 'experience', desc: '拦截时伤害倍率 0.8 → 0.5' },
  { id: 'breakExpert', name: '破势专家', kind: 'passive', category: 'combat', source: 'experience', desc: '破甲值 +30%' },
  { id: 'survivor', name: '惜命者', kind: 'passive', category: 'combat', source: 'experience', desc: 'HP < 50% 时 EVA +15%' },
  { id: 'bloodthirst', name: '嗜血', kind: 'passive', category: 'combat', source: 'experience', desc: '击杀后回复 10% 最大生命' },
  { id: 'executioner', name: '处刑人', kind: 'passive', category: 'combat', source: 'experience', desc: '处决伤害 +20%' },
  { id: 'plasmaVeteran', name: '血账老手', kind: 'passive', category: 'business', source: 'experience', desc: '本人在血浆站产出 +30%' },
  { id: 'minerBody', name: '矿工体魄', kind: 'passive', category: 'business', source: 'experience', desc: 'HP 上限 +10%' },
  { id: 'cultureModel', name: '企业文化标兵', kind: 'passive', category: 'psyche', source: 'experience', desc: '狂信增长 x1.2' },
  { id: 'seasoned', name: '见惯风浪', kind: 'passive', category: 'psyche', source: 'experience', desc: '夺舍带来的疑心增长 −50%' },
  // stress awaken (combat)
  { id: 'lastStand', name: '劫后余生', kind: 'passive', category: 'combat', source: 'awaken', desc: '每场战斗首次 HP 归零时以 1 HP 存活' },
  { id: 'faceJudgement', name: '直面审判', kind: 'passive', category: 'combat', source: 'awaken', desc: '对首领伤害 +15%，不再因首领范围攻击额外后撤' },
  // shadows
  { id: 'bossFear', name: '首领恐惧', kind: 'passive', category: 'psyche', source: 'shadow', desc: '首领在场时后撤 x1.5，ATK −10%' },
  { id: 'bloodShock', name: '血光惊悸', kind: 'passive', category: 'psyche', source: 'shadow', desc: '战斗中每有队友倒地，额外疑心 +5' },
  { id: 'jumpy', name: '惊弓之鸟', kind: 'passive', category: 'psyche', source: 'shadow', desc: '受到攻击后，下次行动后撤意图 x2.0' },
  { id: 'doubtAll', name: '怀疑一切', kind: 'passive', category: 'psyche', source: 'shadow', desc: '疑心增长 x1.3' },
];

export const MEMORIES: Record<string, MemoryDef> = Object.fromEntries(list.map((m) => [m.id, m]));
export const MEMORY_LIST = list;

export interface ExperienceTraitDef {
  traitId: string;
  exp: ExpKey;
  threshold: number;
  /** patriarch can't earn psyche traits (no psyche) */
  childOnly?: boolean;
}

export const EXPERIENCE_TRAITS: ExperienceTraitDef[] = [
  { traitId: 'selfShield', exp: 'intercepts', threshold: 3 },
  { traitId: 'breakExpert', exp: 'breaches', threshold: 10 },
  { traitId: 'survivor', exp: 'safeRetreats', threshold: 5 },
  { traitId: 'bloodthirst', exp: 'kills', threshold: 15 },
  { traitId: 'executioner', exp: 'executions', threshold: 20 },
  { traitId: 'plasmaVeteran', exp: 'plasmaMonths', threshold: 12 },
  { traitId: 'minerBody', exp: 'mineMonths', threshold: 12 },
  { traitId: 'cultureModel', exp: 'trainings', threshold: 10, childOnly: true },
  { traitId: 'seasoned', exp: 'possessionsWitnessed', threshold: 2, childOnly: true },
];

export const EXP_NAMES: Record<ExpKey, string> = {
  intercepts: '拦截',
  breaches: '制造破绽',
  safeRetreats: '安全后撤',
  kills: '击杀',
  executions: '处决',
  plasmaMonths: '血浆站在岗(月)',
  mineMonths: '矿山在岗(月)',
  trainings: '接受培训',
  possessionsWitnessed: '旁观夺舍',
};

export type StressSource = 'downed' | 'allyDowned' | 'heavy' | 'boss' | 'intercept' | 'trauma';

export const AWAKEN_POOL: Record<StressSource, string[]> = {
  downed: ['bloodRage', 'lastStand'],
  allyDowned: ['bloodRage', 'traumaResist'],
  heavy: ['traumaResist'],
  boss: ['faceJudgement'],
  intercept: ['traumaResist', 'lastStand'],
  trauma: ['traumaResist'],
};

export const SHADOW_POOL: Record<StressSource, string[]> = {
  downed: ['doubtAll', 'jumpy'],
  allyDowned: ['bloodShock'],
  heavy: ['jumpy'],
  boss: ['bossFear'],
  intercept: ['doubtAll'],
  trauma: ['doubtAll'],
};
