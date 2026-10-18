import type { FacilityId, Intent, Personality, Stance, TraumaId } from '../core/types';

export const BAL = {
  startGold: 1500,
  patriarchBonusHp: 20,
  patriarchBonusAtk: 5,
  /** shared stat template; gene passives and classes modify it */
  baseStats: { hp: 100, atk: 20, def: 10, arm: 30, spd: 100, mov: 3, eva: 0.05 },

  adultAge: 6,
  pregnancyMonths: 2,
  breedCooldown: 3,
  agingDeathAfter: 18,
  agingSpdPerMonth: 2,
  agingHpPctPerMonth: 0.02,

  upkeep: 100,
  livingCost: 20,

  trainCost: 50,
  trainDevotion: 8,
  galaCost: 300,
  galaSuspicion: -10,
  galaStress: -5,
  treatCost: 400,
  treatStress: -20,
  counselCost: 300,
  counselSuspicion: 5,

  newbornDevotion: 30,

  possessionCost: 500,
  possessionSuspicion: 20,
  possessionMinSync: 20,

  informantFine: 500,
  informantChance: 0.15,

  tierUpGold: 3000,
  tierUpCost: 2000,

  marketRefresh: 3,
  eventChance: 0.4,

  mutateActivate: { mutagen: 3, gold: 200 },
  mutateRandom: { mutagen: 2, gold: 100 },

  /** max distance for the 血影闪现 lunge execution */
  bloodLungeRange: 4,
  /** share of each ally's action interval pulled forward after an execution */
  executionHaste: 0.25,

  /** heal on taking the stairs down */
  floorHeal: 0.2,
  /** one-time heal at a rest point, for every standing member */
  restHeal: 0.35,
  bloodBagHeal: 0.4,
  bloodBagPrice: 30,
  bloodBagMax: 3,
  /** HP share a downed child returns with under 血契唤醒 */
  reviveHp: 0.3,
  /** exploration steps between patrol moves */
  patrolEvery: 2,
  defeatLootLoss: 0.5,
  maxTraumas: 3,
  childTraitCap: 4,

  xpKill: 5,
  xpFloor: 10,
  xpBoss: 50,
  intelThreshold: 10,

  stressDecay: 10,
  stressResetAfterCheck: 30,
};

export const FACILITIES: Record<FacilityId, { name: string; cap: number; output: number; suspicion: number; desc: string }> = {
  plasma: { name: '基础血浆站（出纳）', cap: 3, output: 100, suspicion: 3, desc: '每天经手血袋，难免多想' },
  mine: { name: '矿山', cap: 3, output: 70, suspicion: 1, desc: '老实干活，少问问题' },
};

export const TRAUMAS: Record<TraumaId, { name: string; desc: string }> = {
  bone: { name: '筋骨断裂', desc: 'HP 上限 −10%' },
  nerve: { name: '神经灼伤', desc: 'SPD −8' },
  organ: { name: '内脏破损', desc: 'DEF −3' },
  blood: { name: '血脉紊乱', desc: 'ARM −10' },
};

export const PARTNER_SOURCES = {
  labor: { name: '劳务派遣所', fee: 200, count: 4, tier: 'C' as const, perk: null },
  dwarf: { name: '矮人辛迪加', fee: 600, count: 2, tier: 'C' as const, perk: '【债务质押】告密事件罚金 −50%' },
  elf: { name: '精灵资本', fee: 1500, count: 2, tier: 'B' as const, perk: '【工时监控算法】全族月度疑心 −1' },
};

// ---------- AI tables ----------
export const INTENT_BASE: Record<Intent, number> = {
  attack: 1.0,
  break: 1.0,
  guard: 0.8,
  retreat: 0.6,
  regroup: 0.4,
  defend: 0.3,
  advance: 0.35,
};

export const INTENT_NAMES: Record<Intent, string> = {
  attack: '攻击',
  break: '破势',
  guard: '护驾',
  retreat: '后撤',
  regroup: '集结',
  defend: '防御',
  advance: '推进',
};

type IntentTable = Partial<Record<Intent, number>>;

export const PERSONALITY_MOD: Record<Personality, IntentTable> = {
  zealot: { attack: 1.0, break: 1.0, guard: 2.0, retreat: 0.3, regroup: 1.3, advance: 1.0 },
  paranoid: { attack: 1.1, break: 0.9, guard: 0.5, retreat: 2.0, regroup: 0.7, advance: 0.8 },
  docile: { attack: 1.0, break: 1.0, guard: 1.0, retreat: 1.0, regroup: 1.0, advance: 1.0 },
};

export const INTERCEPT_FACTOR: Record<Personality, number> = { zealot: 1.0, docile: 0.3, paranoid: 0.05 };

export const STANCE_MOD: Record<Stance, IntentTable> = {
  guard: { attack: 0.8, break: 0.9, guard: 1.8, retreat: 1.0, regroup: 1.5, advance: 0.7 },
  assault: { attack: 1.2, break: 1.6, guard: 0.7, retreat: 0.8, regroup: 1.0, advance: 1.2 },
  self: { attack: 1.0, break: 1.0, guard: 0.5, retreat: 1.6, regroup: 0.6, advance: 0.9 },
};

export const STANCE_NAMES: Record<Stance, string> = {
  guard: '收拢护卫',
  assault: '协同合围',
  self: '各自保全',
};

export const ENEMY_MOD: Record<string, IntentTable> = {
  hunter: { attack: 1.0, break: 0.8, advance: 1.0, retreat: 0, guard: 0, regroup: 0 },
  beast: { attack: 1.2, break: 0.6, advance: 1.2, retreat: 0, guard: 0, regroup: 0 },
  shield: { attack: 0.9, break: 1.5, advance: 1.0, retreat: 0, guard: 0, regroup: 0 },
  boss: { attack: 1.1, break: 1.0, advance: 1.0, retreat: 0, guard: 0, regroup: 0 },
};
