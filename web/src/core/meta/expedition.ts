import { BAL } from '../../config/balance';
import { CHEST_LOOT, ENEMIES, LOOT } from '../../config/enemies';
import { MEMORIES, type StressSource } from '../../config/memories';
import { deriveStats, hasPassive, isAdult } from '../character';
import { createBattle, runAiTurn } from '../battle/engine';
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
import { LAST_FLOOR, ROOM_NAMES, generateFloor, linked, pathTo, reveal, roomAt, stepPatrol, type FloorMap, type Room } from './floorMap';
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
  /** guard rooms beaten, counting the boss */
  floorsCleared: number;
  bossKilled: boolean;
  stance: Stance;
  map: FloorMap;
  roomId: number;
  steps: number;
  bloodBags: number;
  /** kept after a won fight until the player leaves the battle screen */
  battle: BattleState | null;
  battleAt: { roomId: number; patrol: boolean } | null;
  phase: 'explore' | 'battle' | 'done';
  outcome: 'retreat' | 'clear' | 'defeat' | null;
  floorLog: string[];
  /** recent exploration messages, newest last */
  events: string[];
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

/** Blood bags are sold once someone works the plasma station. */
export function canBuyBloodBags(g: GameState): boolean {
  return g.members.some((m) => m.job === 'plasma');
}

function maxHp(g: GameState, id: string): number {
  return deriveStats(memberById(g, id)!, g.soul).hp;
}

function note(run: RunState, text: string) {
  run.events.push(text);
  if (run.events.length > 12) run.events.shift();
}

function enterFloor(g: GameState, run: RunState) {
  run.map = generateFloor(run.floor, new Rng(seedFrom(g)));
  run.roomId = run.map.entryId;
  note(run, `进入第 ${run.floor} 层${run.floor >= LAST_FLOOR ? '（首领层）' : ''}`);
}

export function startRun(g: GameState, childIds: string[], difficulty: 1 | 2, bloodBags = 0): StartResult {
  if (difficulty === 2 && g.tier !== 'B') return { ok: false, msg: '难度 II 需要家族阶层 B' };
  if (childIds.length < 1 || childIds.length > 2) return { ok: false, msg: '需要选择 1~2 名随行子嗣' };
  for (const id of childIds) {
    const c = memberById(g, id);
    if (!c || c.isPatriarch || !isAdult(c)) return { ok: false, msg: '只能带成年子嗣出征' };
  }
  if (bloodBags > 0) {
    if (!canBuyBloodBags(g)) return { ok: false, msg: '血浆站有人在岗后才能购买血袋' };
    if (bloodBags > BAL.bloodBagMax) return { ok: false, msg: `每次出征最多携带 ${BAL.bloodBagMax} 袋血袋` };
    const cost = bloodBags * BAL.bloodBagPrice;
    if (g.gold < cost) return { ok: false, msg: '金币不足，买不起这么多血袋' };
    g.gold -= cost;
  }
  const pat = patriarch(g);
  const team = [pat.id, ...childIds];
  const hp: Record<string, number> = {};
  for (const id of team) hp[id] = maxHp(g, id);
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
    map: null as unknown as FloorMap,
    roomId: 0,
    steps: 0,
    bloodBags,
    battle: null,
    battleAt: null,
    phase: 'explore',
    outcome: null,
    floorLog: [],
    events: [],
    stats: { aiBreaches: 0, executionsOnAiBreach: 0, stanceSwitches: 0 },
  };
  enterFloor(g, run);
  return { ok: true, run };
}

function startBattle(g: GameState, run: RunState, room: Room, enemies: string[], initiative: 'ally' | 'enemy' | null, patrol: boolean) {
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
    enemyTypes: enemies,
    layout: room.layout,
    initiative,
  });
  run.battleAt = { roomId: room.id, patrol };
  run.phase = 'battle';
}

export function canMoveTo(run: RunState, roomId: number): boolean {
  return run.phase === 'explore' && linked(run.map, run.roomId, roomId);
}

/** Walks into a linked room. Standing enemies or the patrol there start a fight. */
export function moveTo(g: GameState, run: RunState, roomId: number): boolean {
  if (!canMoveTo(run, roomId)) return false;
  run.battle = null;
  run.roomId = roomId;
  run.steps += 1;
  reveal(run.map, roomId);
  const room = roomAt(run.map, roomId);
  note(run, `进入${ROOM_NAMES[room.kind]}`);
  if (room.enemies) {
    const sneak = hasPassive(patriarch(g), g.soul, 'nightAmbush');
    if (sneak) note(run, '【夜行先机】敌人尚未察觉');
    startBattle(g, run, room, room.enemies, sneak ? 'ally' : null, false);
    return true;
  }
  const patrol = run.map.patrol;
  if (patrol && patrol.roomId === roomId) {
    note(run, '一头撞上了巡逻队！');
    startBattle(g, run, room, patrol.enemies, 'enemy', true);
    return true;
  }
  const rng = new Rng(g.rngState);
  stepPatrol(run.map, run.steps, rng);
  g.rngState = rng.state;
  if (patrol && patrol.roomId === roomId) {
    note(run, '巡逻队摸进了这个房间！');
    startBattle(g, run, room, patrol.enemies, 'enemy', true);
  }
  return true;
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

/** Call once `run.battle.result` is set. Collects the room's loot and returns the run to 'explore' or 'done'. */
export function finishBattle(g: GameState, run: RunState) {
  const b = run.battle;
  if (!b || !b.result || run.phase !== 'battle') return;
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
    const at = run.battleAt!;
    const room = roomAt(run.map, at.roomId);
    const mul = run.difficulty === 2 ? 1.6 : 1;
    let xp = kills * BAL.xpKill;
    let line: string;
    let bossDown = false;
    if (at.patrol) {
      run.map.patrol = null;
      line = '击溃巡逻队';
    } else {
      room.enemies = null;
      const isChest = room.kind === 'side';
      const loot = isChest ? CHEST_LOOT[run.floor] : LOOT[run.floor];
      const gold = Math.round(rng.int(loot.gold[0], loot.gold[1]) * mul);
      const mutagen = rng.chance(loot.mutagenChance) ? Math.round(loot.mutagen * mul) : 0;
      run.gold += gold;
      run.mutagen += mutagen;
      const spoils = `+${gold} 金${mutagen ? `、+${mutagen} 诱变原液` : ''}`;
      if (isChest) {
        room.used = true;
        line = `打开宝箱 ${spoils}`;
      } else {
        run.xp += BAL.xpFloor;
        xp += BAL.xpFloor;
        run.floorsCleared += 1;
        bossDown = b.isBossFloor && (b.killsByType.boss ?? 0) > 0;
        if (bossDown) {
          run.bossKilled = true;
          run.xp += BAL.xpBoss;
          xp += BAL.xpBoss;
        }
        line = `${bossDown ? '击败首领' : '击破守卫'} ${spoils}`;
      }
    }
    run.floorLog.push(`第 ${run.floor} 层 ${line}，历练点 +${xp}`);
    note(run, `战斗胜利：${line}`);
    if (hasPassive(patriarch(g), g.soul, 'bloodPact')) {
      for (const id of [...run.downed]) {
        run.hp[id] = Math.max(1, Math.round(maxHp(g, id) * BAL.reviveHp));
        run.downed = run.downed.filter((x) => x !== id);
        note(run, `【血契唤醒】${memberById(g, id)!.name} 重新站起（${run.hp[id]} HP）`);
      }
    }
    if (bossDown) {
      run.phase = 'done';
      run.outcome = 'clear';
    } else {
      run.phase = 'explore';
    }
  } else {
    run.floorLog.push(`第 ${run.floor} 层战败：族长发动血遁秘术`);
    run.phase = 'done';
    run.outcome = 'defeat';
  }
  g.rngState = rng.state;
}

/** Closes the result screen of a won fight and returns to the map. */
export function leaveBattle(run: RunState) {
  if (run.phase === 'explore') run.battle = null;
}

function heal(g: GameState, run: RunState, id: string, share: number): number {
  const max = maxHp(g, id);
  const before = run.hp[id];
  run.hp[id] = Math.min(max, before + Math.round(max * share));
  return run.hp[id] - before;
}

export function useRest(g: GameState, run: RunState): boolean {
  const room = roomAt(run.map, run.roomId);
  if (run.phase !== 'explore' || room.kind !== 'rest' || room.used) return false;
  room.used = true;
  for (const id of run.team) if (!run.downed.includes(id)) heal(g, run, id, BAL.restHeal);
  note(run, `饮下血库残罐：站着的成员回复 ${Math.round(BAL.restHeal * 100)}% 生命`);
  return true;
}

export function useBloodBag(g: GameState, run: RunState, id: string): boolean {
  if (run.phase !== 'explore' || run.bloodBags <= 0 || !run.team.includes(id) || run.downed.includes(id)) return false;
  if (run.hp[id] >= maxHp(g, id)) return false;
  run.bloodBags -= 1;
  const n = heal(g, run, id, BAL.bloodBagHeal);
  note(run, `${memberById(g, id)!.name} 喝下血袋：+${n} HP`);
  return true;
}

export function canTakeStairs(run: RunState): boolean {
  const room = roomAt(run.map, run.roomId);
  return run.phase === 'explore' && room.kind === 'stairs';
}

export function takeStairs(g: GameState, run: RunState): boolean {
  if (!canTakeStairs(run)) return false;
  run.floor += 1;
  run.battle = null;
  for (const id of run.team) if (!run.downed.includes(id)) heal(g, run, id, BAL.floorHeal);
  enterFloor(g, run);
  return true;
}

export function retreatRun(run: RunState) {
  if (run.phase !== 'explore') return;
  run.battle = null;
  run.phase = 'done';
  run.outcome = 'retreat';
}

/**
 * Simulation policy: heads for the exit, skips side rooms, steps around the patrol when another way exists,
 * detours to an unused rest point below 70% HP and drinks blood bags below 50%.
 */
export function autoExploreStep(g: GameState, run: RunState) {
  if (run.phase !== 'explore') return;
  run.battle = null;
  const standing = run.team.filter((id) => !run.downed.includes(id));
  if (run.bloodBags > 0) {
    const low = standing.find((id) => run.hp[id] < maxHp(g, id) * 0.5);
    if (low && useBloodBag(g, run, low)) return;
  }
  const room = roomAt(run.map, run.roomId);
  const hpShare = standing.reduce((s, id) => s + run.hp[id] / maxHp(g, id), 0) / standing.length;
  if (room.kind === 'rest' && !room.used && hpShare < 0.9) {
    useRest(g, run);
    return;
  }
  if (canTakeStairs(run)) {
    takeStairs(g, run);
    return;
  }
  const rest = run.map.rooms.find((r) => r.kind === 'rest' && !r.used);
  const target = rest && hpShare < 0.7 ? rest.id : run.map.exitId;
  const patrolAt = run.map.patrol?.roomId;
  const path =
    pathTo(run.map, run.roomId, target, (r) => (r.kind === 'side' && !!r.enemies) || r.id === patrolAt) ??
    pathTo(run.map, run.roomId, target, (r) => r.kind === 'side' && !!r.enemies) ??
    pathTo(run.map, run.roomId, run.map.exitId)!;
  moveTo(g, run, path[1]);
}

/** Plays a whole run with the AI patriarch. `onFloor` fires on arriving at each floor. */
export function autoRun(g: GameState, run: RunState, onFloor?: (run: RunState) => void) {
  onFloor?.(run);
  for (let guard = 0; run.phase !== 'done'; guard++) {
    if (guard > 1000) throw new Error('auto run did not finish');
    if (run.phase === 'battle') {
      const b = run.battle!;
      for (let n = 0; !b.result; n++) {
        if (n > 4000) throw new Error('auto battle did not finish');
        runAiTurn(b, { autoPatriarch: true });
      }
      finishBattle(g, run);
    } else {
      const floor = run.floor;
      autoExploreStep(g, run);
      if (run.floor !== floor) onFloor?.(run);
    }
  }
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
