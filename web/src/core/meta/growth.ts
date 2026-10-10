import { BAL, TRAUMAS } from '../../config/balance';
import { AWAKEN_POOL, EXPERIENCE_TRAITS, MEMORIES, SHADOW_POOL, type StressSource } from '../../config/memories';
import { clamp100, devotionGrowthMul, suspicionGrowthMul } from '../character';
import { express } from '../genetics';
import type { Rng } from '../rng';
import type { Character, ExpKey, GameState, TraumaId } from '../types';

export function patriarch(g: GameState): Character {
  return g.members.find((m) => m.isPatriarch)!;
}

export function children(g: GameState): Character[] {
  return g.members.filter((m) => !m.isPatriarch);
}

export function memberById(g: GameState, id: string): Character | undefined {
  return g.members.find((m) => m.id === id);
}

export function addExp(c: Character, k: ExpKey, n: number) {
  if (n <= 0) return;
  c.experience[k] = (c.experience[k] ?? 0) + n;
}

export function addSuspicion(c: Character, delta: number) {
  if (c.isPatriarch) return;
  const d = delta > 0 ? delta * suspicionGrowthMul(c) : delta;
  c.suspicion = clamp100(c.suspicion + d);
}

export function addDevotion(c: Character, delta: number) {
  if (c.isPatriarch) return;
  const d = delta > 0 ? delta * devotionGrowthMul(c) : delta;
  c.devotion = clamp100(c.devotion + d);
}

export function addStress(c: Character, delta: number) {
  if (c.isPatriarch) return;
  c.stress = clamp100(c.stress + delta);
}

/** Gives a positive trait: patriarch -> soul pool; child -> personal (cap 4, else queued for a replace choice). */
export function grantTrait(g: GameState, c: Character, traitId: string, lines: string[]) {
  const def = MEMORIES[traitId];
  if (c.isPatriarch) {
    if (def.category === 'psyche') return;
    if (!g.soul.pool.includes(traitId)) {
      g.soul.pool.push(traitId);
      lines.push(`族长领悟【${def.name}】，写入先祖记忆池`);
    }
    return;
  }
  if (c.traits.includes(traitId)) return;
  if (c.traits.length < BAL.childTraitCap) {
    c.traits.push(traitId);
    lines.push(`${c.name} 获得后天特性【${def.name}】`);
  } else if (!g.pendingTraitChoices.some((p) => p.charId === c.id && p.traitId === traitId)) {
    g.pendingTraitChoices.push({ charId: c.id, traitId });
    lines.push(`${c.name} 获得【${def.name}】，但特性位已满，需要选择替换`);
  }
}

export function checkExperienceTraits(g: GameState, c: Character, lines: string[]) {
  for (const et of EXPERIENCE_TRAITS) {
    if (et.childOnly && c.isPatriarch) continue;
    if ((c.experience[et.exp] ?? 0) < et.threshold) continue;
    const owned = c.isPatriarch ? g.soul.pool.includes(et.traitId) : c.traits.includes(et.traitId);
    const queued = g.pendingTraitChoices.some((p) => p.charId === c.id && p.traitId === et.traitId);
    if (!owned && !queued && !c.declinedTraits.includes(et.traitId)) grantTrait(g, c, et.traitId, lines);
  }
}

export function addTrauma(c: Character, rng: Rng, lines: string[]): TraumaId {
  const t = rng.pick(['bone', 'nerve', 'organ', 'blood'] as TraumaId[]);
  if (c.traumas.length >= BAL.maxTraumas) {
    c.wear += 1;
    lines.push(`${c.name} 的肉体进一步磨损（HP 上限额外 −5%）`);
  } else {
    c.traumas.push(t);
    lines.push(`${c.name} 留下创伤【${TRAUMAS[t].name}】`);
  }
  return t;
}

export function stressCheck(
  g: GameState,
  c: Character,
  sources: Partial<Record<StressSource, number>>,
  rng: Rng,
  lines: string[],
) {
  if (c.isPatriarch || c.stress < 100) return;
  let main: StressSource = 'trauma';
  let best = -1;
  for (const [k, v] of Object.entries(sources) as [StressSource, number][]) {
    if (v > best) {
      best = v;
      main = k;
    }
  }
  const personality = express(c.genome).personality;
  let p = 0.3 + c.devotion * 0.004 - c.traumas.length * 0.05 - (personality === 'paranoid' ? 0.1 : 0);
  p = Math.max(0.1, Math.min(0.8, p));
  if (rng.chance(p)) {
    const pool = AWAKEN_POOL[main].filter((t) => !c.traits.includes(t));
    const t = pool.length ? rng.pick(pool) : null;
    if (t) {
      lines.push(`${c.name} 在应激中觉醒（概率 ${Math.round(p * 100)}%）`);
      grantTrait(g, c, t, lines);
      g.analytics.stressAwaken += 1;
    }
  } else {
    const pool = SHADOW_POOL[main].filter((t) => !c.shadows.includes(t));
    const t = pool.length ? rng.pick(pool) : null;
    if (t) {
      c.shadows.push(t);
      lines.push(`${c.name} 应激崩溃，留下心理阴影【${MEMORIES[t].name}】`);
      g.analytics.stressShadow += 1;
    }
  }
  c.stress = BAL.stressResetAfterCheck;
}

export function nextId(g: GameState, prefix: string): string {
  g.nextId += 1;
  return `${prefix}${g.nextId}`;
}
