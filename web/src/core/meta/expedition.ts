import { BAL } from '../../config/balance';
import { ENEMIES, LOOT } from '../../config/enemies';
import { MEMORIES, type StressSource } from '../../config/memories';
import { deriveStats, isAdult } from '../character';
import { createBattle } from '../battle/engine';
import { express } from '../genetics';
import { Rng } from '../rng';
import type { BattleState, ExpKey, GameState, Stance, UnitTally } from '../types';
import {
  addDevotion,
  addExp,
  addStress,
  addSuspicion,
  addTrauma,
  grantTrait,
  memberById,
  patriarch,
  stressCheck,
} from './growth';
import { advanceMonth } from './month';
import { unitFromCharacter } from './units';

export interface RunState {
  difficulty: 1 | 2;
  /** patriarch first */
  team: string[];
  floor: number;
  hp: Record<string, number>;
  downed: string[];
  gold: number;
  mutagen: number;
  xp: number;
  tallies: Record<string, UnitTally>;
  killsByType: Record<string, number>;
  floorsCleared: number;
  bossKilled: boolean;
  stance: Stance;
  battle: BattleState | null;
  phase: 'battle' | 'between' | 'done';
  outcome: 'retreat' | 'clear' | 'defeat' | null;
  floorLog: string[];
  stats: { aiBreaches: number; executionsOnAiBreach: number; stanceSwitches: number };
}

export type StartResult = { ok: true; run: RunState } | { ok: false; msg: string };

function seedFrom(g: GameState): number {
  const rng = new Rng(g.rngState);
  const s = rng.int(1, 2 ** 31 - 1);
  g.rngState = rng.state;
  return s;
}

export function intelTypes(g: GameState): string[] {
  return Object.entries(g.soul.intel)
    .filter(([, n]) => n >= BAL.intelThreshold)
    .map(([t]) => t);
}

export function startRun(g: GameState, childIds: string[], difficulty: 1 | 2): StartResult {
  if (difficulty === 2 && g.tier !== 'B') return { ok: false, msg: '难度 II 需要家族阶层 B' };
  if (childIds.length < 1 || childIds.length > 2) return { ok: false, msg: '需要选择 1~2 名随行子嗣' };
  for (const id of childIds) {
    const c = memberById(g, id);
    if (!c || c.isPatriarch || !isAdult(c)) return { ok: false, msg: '只能带成年子嗣出征' };
  }
  const pat = patriarch(g);
  const team = [pat.id, ...childIds];
  const hp: Record<string, number> = {};
  for (const id of team) hp[id] = deriveStats(memberById(g, id)!, g.soul).hp;
  const run: RunState = {
    difficulty,
    team,
    floor: 1,
    hp,
    downed: [],
    gold: 0,
    mutagen: 0,
    xp: 0,
    tallies: {},
    killsByType: {},
    floorsCleared: 0,
    bossKilled: false,
    stance: 'assault',
    battle: null,
    phase: 'battle',
    outcome: null,
    floorLog: [],
    stats: { aiBreaches: 0, executionsOnAiBreach: 0, stanceSwitches: 0 },
  };
  startFloor(g, run);
  return { ok: true, run };
}

export function startFloor(g: GameState, run: RunState) {
  const allies = run.team
    .filter((id) => !run.downed.includes(id))
    .map((id) => unitFromCharacter(memberById(g, id)!, g.soul, run.hp[id]));
  run.battle = createBattle({
    allies,
    floor: run.floor,
    difficulty: run.difficulty,
    seed: seedFrom(g),
    stance: run.stance,
    intelTypes: intelTypes(g),
  });
  run.phase = 'battle';
}

function mergeTally(into: UnitTally | undefined, t: UnitTally): UnitTally {
  if (!into) return { ...t, intents: { ...t.intents } };
  into.downed = into.downed || t.downed;
  into.allyDowned += t.allyDowned;
  into.heavyHits += t.heavyHits;
  into.bossHits += t.bossHits;
  into.intercepts += t.intercepts;
  into.breaches += t.breaches;
  into.safeRetreats += t.safeRetreats;
  into.kills += t.kills;
  into.executions += t.executions;
  into.damageTaken += t.damageTaken;
  for (const [k, v] of Object.entries(t.intents)) into.intents[k] = (into.intents[k] ?? 0) + v;
  return into;
}

/** Call once `run.battle.result` is set. Collects loot and moves the run to 'between' or 'done'. */
export function finishBattle(g: GameState, run: RunState) {
  const b = run.battle;
  if (!b || !b.result) return;
  const rng = new Rng(g.rngState);
  for (const u of b.units) {
    if (u.side !== 'ally' || !u.charId) continue;
    run.tallies[u.charId] = mergeTally(run.tallies[u.charId], b.tally[u.id]);
    run.hp[u.charId] = u.hp;
    if (u.downed && u.kind === 'child' && !run.downed.includes(u.charId)) run.downed.push(u.charId);
  }
  let kills = 0;
  for (const [t, n] of Object.entries(b.killsByType)) {
    run.killsByType[t] = (run.killsByType[t] ?? 0) + n;
    kills += n;
  }
  run.xp += kills * BAL.xpKill;
  run.stats.aiBreaches += b.aiBreachIds.length;
  run.stats.executionsOnAiBreach += b.executionsOnAiBreach;
  run.stats.stanceSwitches += b.stanceSwitches;
  run.stance = b.stance;
  g.analytics.battles += 1;

  if (b.result === 'victory') {
    const loot = LOOT[run.floor];
    const mul = run.difficulty === 2 ? 1.6 : 1;
    const gold = Math.round(rng.int(loot.gold[0], loot.gold[1]) * mul);
    const mutagen = rng.chance(loot.mutagenChance) ? Math.round(loot.mutagen * mul) : 0;
    run.gold += gold;
    run.mutagen += mutagen;
    run.xp += BAL.xpFloor;
    run.floorsCleared += 1;
    const bossDown = b.isBossFloor && (b.killsByType.boss ?? 0) > 0;
    if (bossDown) {
      run.bossKilled = true;
      run.xp += BAL.xpBoss;
    }
    run.floorLog.push(
      `第 ${run.floor} 层胜利：+${gold} 金${mutagen ? `、+${mutagen} 诱变原液` : ''}，历练点 +${BAL.xpFloor + kills * BAL.xpKill + (bossDown ? BAL.xpBoss : 0)}`,
    );
    for (const id of run.team) {
      if (run.downed.includes(id)) continue;
      const c = memberById(g, id)!;
      const max = deriveStats(c, g.soul).hp;
      run.hp[id] = Math.min(max, run.hp[id] + Math.round(max * BAL.floorHeal));
    }
    if (run.floor >= 4) {
      run.phase = 'done';
      run.outcome = 'clear';
    } else {
      run.phase = 'between';
    }
  } else {
    run.floorLog.push(`第 ${run.floor} 层战败：族长发动血遁秘术`);
    run.phase = 'done';
    run.outcome = 'defeat';
  }
  g.rngState = rng.state;
}

export function continueRun(g: GameState, run: RunState) {
  if (run.phase !== 'between') return;
  run.floor += 1;
  startFloor(g, run);
}

export function retreatRun(run: RunState) {
  if (run.phase !== 'between') return;
  run.phase = 'done';
  run.outcome = 'retreat';
}

const EXP_FROM_TALLY: [keyof UnitTally, ExpKey][] = [
  ['intercepts', 'intercepts'],
  ['breaches', 'breaches'],
  ['safeRetreats', 'safeRetreats'],
  ['kills', 'kills'],
  ['executions', 'executions'],
];

/** Apply the run's results to the family, then run the monthly settlement. Returns the report lines. */
export function settleRun(g: GameState, run: RunState): string[] {
  const rng = new Rng(g.rngState);
  const lines: string[] = [];
  const defeat = run.outcome === 'defeat';
  const outcomeName = run.outcome === 'clear' ? '通关' : run.outcome === 'retreat' ? '撤退' : '战败';
  lines.push(`【出征】${outcomeName}，共通过 ${run.floorsCleared} 层`);
  lines.push(...run.floorLog.map((l) => `　${l}`));

  let gold = run.gold;
  let mutagen = run.mutagen;
  if (defeat) {
    gold = Math.floor(gold * (1 - BAL.defeatLootLoss));
    mutagen = Math.floor(mutagen * (1 - BAL.defeatLootLoss));
    lines.push(`　战败损失一半战利品`);
  }
  g.gold += gold;
  g.mutagen += mutagen;
  g.soul.soulXP += run.xp;
  lines.push(`　带回 ${gold} 金、${mutagen} 诱变原液，历练点 +${run.xp}`);

  for (const [t, n] of Object.entries(run.killsByType)) {
    const before = g.soul.intel[t] ?? 0;
    g.soul.intel[t] = before + n;
    if (before < BAL.intelThreshold && before + n >= BAL.intelThreshold)
      lines.push(`　【敌情解析】对 ${ENEMIES[t]?.name ?? t} 的研究完成：伤害 +15%（常驻）`);
  }

  g.soul.stats.battles += 1;
  if (run.bossKilled) {
    g.soul.stats.bossKills += 1;
    if (!g.license) {
      g.license = true;
      lines.push('　【牌照】击败审判官，获得特许经营牌照！可在家族页申请晋升 B 级');
    }
  }

  const pat = patriarch(g);
  const childIds = run.team.slice(1);
  const patTally = run.tallies[pat.id];
  if (patTally) for (const [tk, ek] of EXP_FROM_TALLY) addExp(pat, ek, patTally[tk] as number);

  if (defeat) {
    const traumasBefore = pat.traumas.length;
    addTrauma(pat, rng, lines);
    const awaken: string[] = [];
    if (g.soul.stats.defeats === 0) awaken.push('bloodRage');
    if (traumasBefore >= 2) awaken.push('traumaResist');
    if (childIds.length > 0 && childIds.every((id) => run.downed.includes(id))) awaken.push('tailCut');
    if (run.floor === 4) awaken.push('bloodDebt');
    for (const t of awaken) {
      if (!g.soul.pool.includes(t)) {
        lines.push(`　【绝境觉醒】真祖意志在屈辱中淬炼出【${MEMORIES[t].name}】，写入先祖记忆池`);
        grantTrait(g, pat, t, []);
      }
    }
    g.soul.stats.defeats += 1;
    g.analytics.defeats += 1;
  }

  const won = !defeat && run.floorsCleared > 0;
  for (const id of childIds) {
    const c = memberById(g, id);
    const t = run.tallies[id];
    if (!c || !t) continue;
    for (const [tk, ek] of EXP_FROM_TALLY) addExp(c, ek, t[tk] as number);
    const personality = express(c.genome).personality;
    const src: Partial<Record<StressSource, number>> = {};
    const add = (k: StressSource, v: number) => {
      if (v <= 0) return;
      src[k] = (src[k] ?? 0) + v;
      addStress(c, v);
    };
    if (t.downed) {
      add('downed', 40);
      addTrauma(c, rng, lines);
      add('trauma', 10);
    }
    add('allyDowned', 15 * t.allyDowned);
    add('heavy', 10 * t.heavyHits);
    add('boss', 10 * t.bossHits);
    add('intercept', 5 * t.intercepts * (personality === 'zealot' ? 0.5 : 1));
    if (t.allyDowned > 0) addSuspicion(c, t.allyDowned * (5 + (c.shadows.includes('bloodShock') ? 5 : 0)));
    if (won) addDevotion(c, 3);
    stressCheck(g, c, src, rng, lines);
    for (const [k, v] of Object.entries(t.intents)) {
      const bucket = (g.analytics.intentCounts[personality] ??= {});
      bucket[k] = (bucket[k] ?? 0) + v;
    }
    g.analytics.intercepts += t.intercepts;
  }
  g.analytics.aiBreaches += run.stats.aiBreaches;
  g.analytics.executionsOnAiBreach += run.stats.executionsOnAiBreach;
  g.analytics.stanceSwitches += run.stats.stanceSwitches;

  g.rngState = rng.state;
  return advanceMonth(g, lines);
}
