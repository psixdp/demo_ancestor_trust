import { BAL } from '../config/balance';
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
  skills: string[];
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

export function deriveStats(c: Character, soul: Soul): DerivedStats {
  const p = express(c.genome);
  let hp = p.hp;
  let atk = BAL.baseAtk * p.atkMul;
  let def = p.def;
  let arm = p.arm;
  let spd = p.spd;

  if (c.isPatriarch) {
    hp = (hp + BAL.patriarchBonusHp) * c.syncMul;
    atk = (atk + BAL.patriarchBonusAtk) * c.syncMul;
    def = def * c.syncMul;
  }
  if (hasPassive(c, soul, 'minerBody')) hp *= 1.1;

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

  return {
    hp: Math.max(10, Math.round(hp)),
    atk: Math.max(1, Math.round(atk)),
    def: Math.max(0, Math.round(def)),
    arm: Math.max(5, Math.round(arm)),
    spd: Math.max(40, Math.round(spd)),
    mov: p.mov,
    eva: p.eva,
    slots: p.slots,
    skills: p.skills,
    personality: p.personality,
    delayResist: p.delayResist,
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
