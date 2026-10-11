import type { StatMods } from '../config/alleles';
import { BAL } from '../config/balance';
import { CLASSES, type ClassDef } from '../config/classes';
import { MEMORIES } from '../config/memories';
import { express } from './genetics';
import type { Character, Personality, Soul } from './types';

export interface DerivedStats {
  hp: number;
  atk: number;
  def: number;
  arm: number;
  spd: number;
  mov: number;
  eva: number;
  slots: number;
  /** class active skills (the basic attack and patriarch memories are added by the battle unit) */
  skills: string[];
  /** gene and class passives */
  passives: string[];
  personality: Personality;
  delayResist: boolean;
  agingStart: number;
  devotionMul: number;
  suspicionMul: number;
}

/** Passive ids currently in effect for this character (children: traits + shadows; patriarch: equipped memories). */
export function activePassives(c: Character, soul: Soul): string[] {
  if (c.isPatriarch) return soul.equipped.filter((id) => MEMORIES[id]?.kind === 'passive');
  return [...c.traits, ...c.shadows];
}

export function hasPassive(c: Character, soul: Soul, id: string): boolean {
  return activePassives(c, soul).includes(id);
}

export function agedMonths(c: Character): number {
  return Math.max(0, c.ageMonths - express(c.genome).agingStart);
}

export function classOf(c: Character): ClassDef | null {
  return c.classId ? (CLASSES[c.classId] ?? null) : null;
}

/** Gene passives plus the class passive. Acquired traits and memories come from `activePassives`. */
export function bodyPassives(c: Character): string[] {
  const cls = classOf(c);
  return [...express(c.genome).passives, ...(cls ? [cls.passive] : [])];
}

/**
 * Order: base template -> gene flat mods -> class flat mods -> patriarch soul bonus
 * -> summed percentage mods -> trauma / wear -> aging -> possession sync.
 */
export function deriveStats(c: Character, soul: Soul): DerivedStats {
  const p = express(c.genome);
  const cls = classOf(c);
  const base = BAL.baseStats;
  const mod = (k: keyof StatMods) => (p.mods[k] ?? 0) + (cls?.mods[k] ?? 0);

  let hp = base.hp + mod('hp');
  let atk = base.atk + mod('atk');
  let def = base.def + mod('def');
  let arm = base.arm + mod('arm');
  let spd = base.spd + mod('spd');
  const mov = base.mov + mod('mov');
  const eva = base.eva + mod('eva');

  if (c.isPatriarch) {
    hp += BAL.patriarchBonusHp;
    atk += BAL.patriarchBonusAtk;
  }
  hp *= 1 + mod('hpPct') + (hasPassive(c, soul, 'minerBody') ? 0.1 : 0);
  atk *= 1 + mod('atkPct');

  for (const t of c.traumas) {
    if (t === 'bone') hp *= 0.9;
    if (t === 'nerve') spd -= 8;
    if (t === 'organ') def -= 3;
    if (t === 'blood') arm -= 10;
  }
  hp *= Math.max(0.3, 1 - 0.05 * c.wear);

  const aged = agedMonths(c);
  spd -= BAL.agingSpdPerMonth * aged;
  hp *= Math.max(0.4, 1 - BAL.agingHpPctPerMonth * aged);

  if (c.isPatriarch) {
    hp *= c.syncMul;
    atk *= c.syncMul;
    def *= c.syncMul;
  }

  const passives = bodyPassives(c);
  return {
    hp: Math.max(10, Math.round(hp)),
    atk: Math.max(1, Math.round(atk)),
    def: Math.max(0, Math.round(def)),
    arm: Math.max(5, Math.round(arm)),
    spd: Math.max(40, Math.round(spd)),
    mov: Math.max(1, Math.round(mov)),
    eva: Math.max(0, Math.min(0.6, eva)),
    slots: p.slots,
    skills: cls ? [...cls.skills] : [],
    passives,
    personality: p.personality,
    delayResist: passives.includes('gene.steady'),
    agingStart: p.agingStart,
    devotionMul: p.devotionMul,
    suspicionMul: p.suspicionMul,
  };
}

export function isAdult(c: Character): boolean {
  return c.ageMonths >= BAL.adultAge;
}

export function lifeStage(c: Character): '幼年' | '成年' | '衰老' {
  if (!isAdult(c)) return '幼年';
  if (c.ageMonths >= express(c.genome).agingStart) return '衰老';
  return '成年';
}

export function monthsToAging(c: Character): number {
  return express(c.genome).agingStart - c.ageMonths;
}

export function monthsToDeath(c: Character): number {
  return express(c.genome).agingStart + BAL.agingDeathAfter - c.ageMonths;
}

export function syncRate(c: Character): number {
  return Math.max(0, Math.min(100, c.devotion - Math.max(0, c.suspicion - 40)));
}

export function possessionPreview(c: Character) {
  const sync = syncRate(c);
  const slots = express(c.genome).slots;
  const active = Math.max(1, Math.floor(slots * (0.5 + sync / 200)));
  const syncMul = 0.85 + (0.15 * sync) / 100;
  return { sync, slots, active, syncMul };
}

export function suspicionGrowthMul(c: Character): number {
  const p = express(c.genome);
  return p.suspicionMul * (c.shadows.includes('doubtAll') ? 1.3 : 1);
}

export function devotionGrowthMul(c: Character): number {
  const p = express(c.genome);
  return p.devotionMul * (c.traits.includes('cultureModel') ? 1.2 : 1);
}

export function clamp100(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}
