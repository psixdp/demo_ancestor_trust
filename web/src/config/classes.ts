import type { Intent } from '../core/types';
import type { StatMods } from './alleles';

export type ClassTier = 'basic' | 'advanced';

export interface ClassDef {
  id: string;
  name: string;
  tier: ClassTier;
  mods: StatMods;
  /** active skills granted on top of the basic attack */
  skills: string[];
  /** class passive id, prefix `job.` */
  passive: string;
  passiveName: string;
  passiveDesc: string;
  /** display only for now; not enforced */
  suggestedFrom?: string;
  bias: Intent[];
  desc: string;
}

export const TIER_NAMES: Record<ClassTier, string> = { basic: '初阶', advanced: '高阶' };

export const CLASS_LIST: ClassDef[] = [
  {
    id: 'charger',
    name: '冲锋者',
    tier: 'basic',
    mods: { hp: 10 },
    skills: ['ram'],
    passive: 'job.impactForce',
    passiveName: '冲击力',
    passiveDesc: '自己造成的撞击失衡伤害由 10% 提高到 15% 最大生命',
    bias: ['break'],
    desc: '把敌人推向墙壁和同伴，撞出破绽',
  },
  {
    id: 'breaker',
    name: '蚀甲者',
    tier: 'basic',
    mods: { atk: 2 },
    skills: ['acid'],
    passive: 'job.exposeWeakness',
    passiveName: '剖开弱点',
    passiveDesc: '由自己的破甲使目标进入破绽时，目标额外 Delay 25%',
    bias: ['break'],
    desc: '专职破甲，并为族长拉长处决窗口',
  },
  {
    id: 'warden',
    name: '护卫',
    tier: 'basic',
    mods: { def: 5, arm: 10 },
    skills: ['shieldBash'],
    passive: 'job.guardPosture',
    passiveName: '护卫姿态',
    passiveDesc: '触发反应拦截后进入防御状态，直到自身下次行动',
    bias: ['guard'],
    desc: '贴身护驾，替族长挡刀',
  },
  {
    id: 'hunter',
    name: '猎手',
    tier: 'basic',
    mods: { spd: 10 },
    skills: ['markShot'],
    passive: 'job.spotter',
    passiveName: '观测手',
    passiveDesc: '被自己 Delay 的目标在其下次行动前，受到族长的伤害 +20%',
    bias: ['attack', 'break'],
    desc: '远程压制，替族长标出下一个猎物',
  },
  {
    id: 'vanguard',
    name: '破阵者',
    tier: 'advanced',
    mods: { hp: 20, atk: 3 },
    skills: ['ram', 'quake'],
    passive: 'job.chainImpact',
    passiveName: '连锁冲击',
    passiveDesc: '被自己击退的单位撞上其他敌人时，两者都进入破绽',
    suggestedFrom: 'charger',
    bias: ['break'],
    desc: '在敌阵中心制造连环失衡',
  },
  {
    id: 'bulwark',
    name: '铁壁',
    tier: 'advanced',
    mods: { hp: 20, def: 8, arm: 20, spd: -10 },
    skills: ['shieldBash', 'taunt'],
    passive: 'job.bulwark',
    passiveName: '不动如山',
    passiveDesc: '受到伤害 −10%',
    suggestedFrom: 'warden',
    bias: ['guard'],
    desc: '主动吸引火力，让族长腾出手来',
  },
  {
    id: 'shade',
    name: '影猎',
    tier: 'advanced',
    mods: { spd: 15, eva: 0.05 },
    skills: ['markShot', 'shadowShot'],
    passive: 'job.shadowAim',
    passiveName: '影袭',
    passiveDesc: '背击伤害系数由 1.5 提高到 1.8',
    suggestedFrom: 'hunter',
    bias: ['attack'],
    desc: '绕后穿影，专挑背面下手',
  },
];

export const CLASSES: Record<string, ClassDef> = Object.fromEntries(CLASS_LIST.map((c) => [c.id, c]));
