import { BAL, INTERCEPT_FACTOR } from '../../config/balance';
import { ENEMIES, ENCOUNTERS, LAYOUTS } from '../../config/enemies';
import { SKILLS, type SkillDef } from '../../config/skills';
import { INTERCEPT_BARKS, BARKS, SLACK_BARKS } from '../../config/texts';
import { decide } from '../ai';
import { Rng } from '../rng';
import type { BattleFx, BattleState, Dir, Intent, Stance, Unit, UnitTally } from '../types';
import {
  DIRS,
  alive,
  armorBreakOf,
  canTarget,
  crossTiles,
  dirTo,
  effectiveEva,
  estimateDamage,
  getUnit,
  inBounds,
  isMeleeSkill,
  key,
  knockbackOf,
  manhattan,
  opponents,
  patriarchOf,
  reachable,
  effectiveMov,
  simulatePush,
  skillReady,
  sweepTiles,
  unitAt,
  walkable,
} from './rules';

// ---------- setup ----------

export interface BattleSetup {
  allies: Unit[];
  floor: number;
  difficulty: 1 | 2;
  seed: number;
  stance: Stance;
  intelTypes: string[];
  /** fixed enemy group; rolled from ENCOUNTERS[floor] when omitted */
  enemyTypes?: string[];
  /** index into LAYOUTS; random when omitted */
  layout?: number;
  /** side that opens the fight a full action interval ahead */
  initiative?: 'ally' | 'enemy' | null;
}

function emptyTally(): UnitTally {
  return {
    downed: false,
    allyDowned: 0,
    heavyHits: 0,
    bossHits: 0,
    intercepts: 0,
    breaches: 0,
    safeRetreats: 0,
    kills: 0,
    executions: 0,
    intents: {},
    damageTaken: 0,
  };
}

export function makeEnemyUnit(typeId: string, idx: number, difficulty: 1 | 2): Unit {
  const d = ENEMIES[typeId];
  const mul = difficulty === 2 ? 1.4 : 1;
  const hp = Math.round(d.hp * mul);
  return {
    id: `e${idx}`,
    name: d.name,
    side: 'enemy',
    kind: 'enemy',
    enemyType: d.id,
    isBoss: !!d.isBoss,
    x: 0,
    y: 0,
    facing: 2,
    hp,
    maxHp: hp,
    atk: Math.round(d.atk * mul),
    def: d.def,
    arm: d.arm,
    maxArm: d.arm,
    spd: d.spd,
    mov: d.mov,
    eva: d.eva,
    delayResist: false,
    nextActAt: 0,
    turnCount: 0,
    breached: false,
    defending: false,
    downed: false,
    skills: d.skills.map((id) => ({ id, readyAt: 0 })),
    passives: [],
    personality: null,
    devotion: 0,
    suspicion: 0,
    aiType: d.aiType,
    interceptReady: false,
    nextAttackBonus: 0,
    order: null,
    holdDamageCut: false,
    spotted: false,
    tauntedBy: null,
    shaken: false,
    lastStandUsed: false,
    boss: d.isBoss ? { step: 0, crossTiles: null, markTarget: null } : null,
  };
}

export function createBattle(setup: BattleSetup): BattleState {
  const rng = new Rng(setup.seed);
  const layout = setup.layout !== undefined ? LAYOUTS[setup.layout % LAYOUTS.length] : rng.pick(LAYOUTS);
  const w = 8;
  const h = 8;
  const blocked = new Array(w * h).fill(false);
  for (const [x, y] of layout) blocked[y * w + x] = true;

  const s: BattleState = {
    w,
    h,
    blocked,
    units: [],
    stance: setup.stance,
    activeId: null,
    turn: { moved: false, acted: false, startX: 0, startY: 0 },
    log: [],
    fx: [],
    fxSeq: 0,
    decisions: [],
    result: null,
    floor: setup.floor,
    isBossFloor: false,
    difficulty: setup.difficulty,
    rngState: 0,
    tally: {},
    killsByType: {},
    retreatWatch: {},
    aiBreachIds: [],
    executionsOnAiBreach: 0,
    stanceSwitches: 0,
    intelTypes: setup.intelTypes,
    executeKillRefund: false,
    defendedThisTurn: false,
    aiSeq: 0,
  };

  const allySpots: [number, number][] = [
    [4, 7],
    [3, 6],
    [5, 6],
    [2, 7],
  ];
  setup.allies.forEach((u, i) => {
    const [x, y] = allySpots[i];
    u.x = x;
    u.y = y;
    u.facing = 0;
    s.units.push(u);
  });

  const enemyTypes: string[] = [];
  if (setup.enemyTypes) enemyTypes.push(...setup.enemyTypes);
  else
    for (const [type, min, max] of rng.pick(ENCOUNTERS[setup.floor])) {
      const n = rng.int(min, max);
      for (let i = 0; i < n; i++) enemyTypes.push(type);
    }
  s.isBossFloor = enemyTypes.includes('boss');
  const spots: [number, number][] = [];
  for (let y = 0; y <= 1; y++) for (let x = 0; x < w; x++) if (!(x === 3 && y === 0)) spots.push([x, y]);
  rng.shuffle(spots);
  let spotIdx = 0;
  enemyTypes.forEach((type, i) => {
    const e = makeEnemyUnit(type, i, setup.difficulty);
    if (type === 'boss') {
      e.x = 3;
      e.y = 0;
    } else {
      [e.x, e.y] = spots[spotIdx++];
    }
    s.units.push(e);
  });

  const lagging = setup.initiative === 'ally' ? 'enemy' : setup.initiative === 'enemy' ? 'ally' : null;
  for (const u of s.units) {
    u.nextActAt = (1000 / u.spd) * rng.range(0.8, 1.0);
    if (u.side === lagging) u.nextActAt += 1000 / u.spd;
    s.tally[u.id] = emptyTally();
  }
  s.rngState = rng.state;
  s.log.push(`第 ${setup.floor} 层${s.isBossFloor ? '（首领战）' : ''}：遭遇 ${enemyTypes.map((t) => ENEMIES[t].name).join('、')}`);
  if (setup.initiative === 'ally') s.log.push('【先手】敌人尚未察觉，我方先动');
  if (setup.initiative === 'enemy') s.log.push('【遭伏击】敌方先动');
  beginNextTurn(s);
  return s;
}

// ---------- helpers ----------

function pushFx(s: BattleState, f: Omit<BattleFx, 'id'>) {
  s.fx.push({ id: ++s.fxSeq, ...f });
  if (s.fx.length > 40) s.fx.splice(0, s.fx.length - 40);
}

function fx(s: BattleState, kind: 'dmg' | 'heal' | 'bubble' | 'text', unitId: string, text: string) {
  pushFx(s, { kind, unitId, text });
}

function moveFx(s: BattleState, u: Unit, path: [number, number][]) {
  if (path.length < 2) return;
  pushFx(s, { kind: 'move', unitId: u.id, text: '', path: path.map(([x, y]) => [x, y]) });
}

/** Sets a unit's tile outside of pathed movement (dash, knockback, swap) and records the slide. */
function relocate(s: BattleState, u: Unit, x: number, y: number) {
  if (u.x === x && u.y === y) return;
  moveFx(s, u, [
    [u.x, u.y],
    [x, y],
  ]);
  u.x = x;
  u.y = y;
}

function log(s: BattleState, line: string) {
  s.log.push(line);
  if (s.log.length > 200) s.log.splice(0, s.log.length - 200);
}

function withRng<T>(s: BattleState, fn: (rng: Rng) => T): T {
  const rng = new Rng(s.rngState);
  const r = fn(rng);
  s.rngState = rng.state;
  return r;
}

function setCooldown(u: Unit, skillId: string) {
  const st = u.skills.find((x) => x.id === skillId);
  if (st) st.readyAt = u.turnCount + SKILLS[skillId].cooldown + 1;
}

/** Upcoming turn order; the active unit is assumed to spend a full action. */
export function timeline(s: BattleState, count = 10): Unit[] {
  const active = getUnit(s, s.activeId);
  const sim = alive(s).map((u) => ({ u, t: u.id === active?.id ? u.nextActAt + 1000 / u.spd : u.nextActAt }));
  const out: Unit[] = [];
  if (sim.length === 0) return out;
  if (active && !active.downed) out.push(active);
  while (out.length < count) {
    sim.sort((a, b) => a.t - b.t);
    const first = sim[0];
    out.push(first.u);
    first.t += 1000 / first.u.spd;
  }
  return out;
}

function checkResult(s: BattleState) {
  const pat = patriarchOf(s);
  if (!pat || pat.downed) {
    s.result = 'defeat';
    return;
  }
  if (!alive(s).some((u) => u.side === 'enemy')) s.result = 'victory';
}

// ---------- turn flow ----------

export function beginNextTurn(s: BattleState) {
  checkResult(s);
  if (s.result) {
    s.activeId = null;
    return;
  }
  const next = alive(s).sort((a, b) => a.nextActAt - b.nextActAt)[0];
  s.activeId = next.id;
  next.turnCount += 1;
  if (next.breached) {
    next.breached = false;
    next.arm = next.maxArm;
    log(s, `${next.name} 恢复了架势`);
  }
  next.defending = false;
  next.spotted = false;
  next.interceptReady = true;
  if (s.retreatWatch[next.id]) {
    s.tally[next.id].safeRetreats += 1;
    delete s.retreatWatch[next.id];
  }
  if (next.passives.includes('bloodBody')) heal(s, next, Math.round(next.maxHp * 0.03));
  s.turn = { moved: false, acted: false, startX: next.x, startY: next.y };
  s.executeKillRefund = false;
  s.defendedThisTurn = false;
}

export function endTurn(s: BattleState) {
  const u = getUnit(s, s.activeId);
  if (!u) return;
  let cost = 0.7;
  if (s.turn.acted) cost = 1.0;
  if (s.defendedThisTurn) cost = 0.8;
  u.tauntedBy = null;
  if (!u.downed) {
    u.nextActAt += (1000 / u.spd) * cost;
    if (s.executeKillRefund) u.nextActAt -= (1000 / u.spd) * cost * 0.5;
    if (u.kind === 'child') {
      u.order = null;
      u.holdDamageCut = false;
    }
    u.shaken = false;
  }
  beginNextTurn(s);
}

export function isPlayerTurn(s: BattleState): boolean {
  const u = getUnit(s, s.activeId);
  return !!u && u.kind === 'patriarch' && !s.result;
}

// ---------- movement ----------

function moveAlong(s: BattleState, u: Unit, path: [number, number][]) {
  if (path.length < 2) return;
  const [lx, ly] = path[path.length - 2];
  const [tx, ty] = path[path.length - 1];
  moveFx(s, u, path);
  u.facing = dirTo(lx, ly, tx, ty);
  u.x = tx;
  u.y = ty;
}

export function playerMoveTargets(s: BattleState): Map<string, [number, number][]> {
  const u = getUnit(s, s.activeId);
  if (!u || s.turn.moved || s.turn.acted) return new Map();
  return reachable(s, u, effectiveMov(u));
}

export function playerMove(s: BattleState, x: number, y: number): boolean {
  const u = getUnit(s, s.activeId);
  if (!u || s.turn.moved || s.turn.acted) return false;
  const path = playerMoveTargets(s).get(key(x, y));
  if (!path) return false;
  moveAlong(s, u, path);
  s.turn.moved = true;
  return true;
}

export function playerUndoMove(s: BattleState): boolean {
  const u = getUnit(s, s.activeId);
  if (!u || !s.turn.moved || s.turn.acted) return false;
  if (unitAt(s, s.turn.startX, s.turn.startY)) return false;
  relocate(s, u, s.turn.startX, s.turn.startY);
  s.turn.moved = false;
  return true;
}

// ---------- damage pipeline ----------

function heal(s: BattleState, u: Unit, amt: number) {
  const before = u.hp;
  u.hp = Math.min(u.maxHp, u.hp + amt);
  if (u.hp > before) fx(s, 'heal', u.id, `+${u.hp - before}`);
}

function setBreach(s: BattleState, attacker: Unit, t: Unit, reason: string) {
  if (t.breached || t.downed) return;
  t.breached = true;
  t.arm = 0;
  // Losing balance wipes the target's accumulated action progress, so it waits a full interval from now.
  const now = getUnit(s, s.activeId)?.nextActAt ?? t.nextActAt;
  t.nextActAt = Math.max(t.nextActAt, now + 1000 / t.spd);
  fx(s, 'text', t.id, '破绽!');
  log(s, `${t.name} 陷入破绽（${reason}），行动进度清空`);
  if (reason === '破甲' && attacker.passives.includes('job.exposeWeakness')) {
    t.nextActAt += (1000 / t.spd) * 0.25 * (t.delayResist ? 0.5 : 1);
    log(s, `${attacker.name}【剖开弱点】：${t.name} 的行动被推迟`);
  }
  if (attacker.side === 'ally') {
    s.tally[attacker.id].breaches += 1;
    if (attacker.kind === 'child' && !s.aiBreachIds.includes(t.id)) s.aiBreachIds.push(t.id);
  }
}

function knockOut(s: BattleState, t: Unit, killer: Unit | null) {
  if (t.passives.includes('lastStand') && !t.lastStandUsed) {
    t.lastStandUsed = true;
    t.hp = 1;
    fx(s, 'text', t.id, '劫后余生!');
    log(s, `${t.name} 凭借【劫后余生】撑住了最后一口气`);
    return;
  }
  t.hp = 0;
  t.downed = true;
  t.breached = false;
  if (t.side === 'enemy') {
    log(s, `${t.name} 被击倒`);
    if (killer) {
      s.tally[killer.id].kills += 1;
      if (killer.passives.includes('bloodthirst')) heal(s, killer, Math.round(killer.maxHp * 0.1));
    }
    if (t.enemyType) s.killsByType[t.enemyType] = (s.killsByType[t.enemyType] ?? 0) + 1;
  } else if (t.kind === 'child') {
    s.tally[t.id].downed = true;
    log(s, `${t.name} 倒地，退出战斗`);
    fx(s, 'text', t.id, '倒地');
    for (const o of s.units) if (o.kind === 'child' && o.id !== t.id && !o.downed) s.tally[o.id].allyDowned += 1;
  } else {
    log(s, `${t.name} 重伤！血遁秘术发动`);
  }
  delete s.retreatWatch[t.id];
}

function applyDamage(s: BattleState, a: Unit | null, t: Unit, dmg: number, opts: { boss?: boolean } = {}) {
  dmg = Math.max(1, Math.round(dmg));
  t.hp -= dmg;
  fx(s, 'dmg', t.id, `-${dmg}`);
  const tally = s.tally[t.id];
  tally.damageTaken += dmg;
  if (dmg >= t.maxHp * 0.3) tally.heavyHits += 1;
  if (opts.boss) tally.bossHits += 1;
  delete s.retreatWatch[t.id];
  if (t.passives.includes('jumpy')) t.shaken = true;
  if (t.holdDamageCut) t.holdDamageCut = false;
  if (t.hp <= 0) knockOut(s, t, a);
}

/** Pick a zealous child to step in front of the patriarch. Returns the new target. */
function tryIntercept(s: BattleState, attacker: Unit, target: Unit): Unit {
  if (target.kind !== 'patriarch' || attacker.side !== 'enemy') return target;
  const cands = alive(s).filter(
    (u) => u.kind === 'child' && u.interceptReady && !u.breached && manhattan(u.x, u.y, target.x, target.y) === 1,
  );
  return withRng(s, (rng) => {
    const scored = cands
      .map((u) => {
        let p = (u.devotion / 100) * INTERCEPT_FACTOR[u.personality ?? 'docile'];
        if (u.suspicion >= 60) p *= 0.5;
        return { u, p };
      })
      .sort((a, b) => b.p - a.p);
    for (const { u, p } of scored) {
      if (rng.chance(p)) {
        const px = target.x;
        const py = target.y;
        relocate(s, target, u.x, u.y);
        relocate(s, u, px, py);
        u.interceptReady = false;
        s.tally[u.id].intercepts += 1;
        fx(s, 'bubble', u.id, rng.pick(INTERCEPT_BARKS));
        log(s, `${u.name} 反应拦截，替 ${target.name} 挡下攻击！`);
        if (u.passives.includes('job.guardPosture')) {
          u.defending = true;
          log(s, `${u.name}【护卫姿态】：进入防御`);
        }
        return u;
      }
    }
    return target;
  });
}

interface StrikeOpts {
  execution?: boolean;
  multOverride?: number;
  aoe?: boolean;
  fromBoss?: boolean;
}

/** One attack from `a` against `t` with skill `sk`. Handles interception, hit, damage, armor, push, delay. */
function strike(s: BattleState, a: Unit, t0: Unit, sk: SkillDef, opts: StrikeOpts = {}) {
  let t = t0;
  let interceptMul = 1;
  if (!opts.aoe) {
    const nt = tryIntercept(s, a, t0);
    if (nt !== t0) {
      t = nt;
      interceptMul = t.passives.includes('selfShield') ? 0.5 : 0.8;
    }
  }
  a.facing = dirTo(a.x, a.y, t.x, t.y);

  const hit = opts.execution ? true : withRng(s, (rng) => !rng.chance(effectiveEva(t)));
  if (!hit) {
    fx(s, 'text', t.id, '闪避');
    log(s, `${a.name} 的${sk.name}被 ${t.name} 闪开了`);
    a.nextAttackBonus = 0;
    return;
  }

  let mult = opts.multOverride ?? sk.mult;
  if (opts.execution) {
    mult = 2.5;
    if (a.passives.includes('execMastery')) mult *= 1.3;
    if (a.passives.includes('executioner')) mult *= 1.2;
    if (a.passives.includes('bloodDebt')) mult *= 1.25;
  }
  const est = estimateDamage(s, a, t, mult, a.x, a.y, { ignoreDef: opts.execution });
  const roll = withRng(s, (rng) => rng.range(0.9, 1.1));
  const dmg = est.raw * roll * interceptMul;
  a.nextAttackBonus = 0;
  const wasAiBreach = s.aiBreachIds.includes(t.id) && t.breached;
  const verb = opts.execution ? ' 处决' : ` 使用${sk.name}`;
  log(s, `${a.name}${verb} → ${t.name}${est.back ? '（背击）' : ''}：${Math.round(dmg)}`);
  applyDamage(s, a, t, dmg, { boss: opts.fromBoss });
  if (a.passives.includes('gene.fang') && !a.downed && (opts.execution || isMeleeSkill(sk))) heal(s, a, Math.round(dmg * 0.15));

  if (opts.execution) {
    s.tally[a.id].executions += 1;
    if (wasAiBreach) s.executionsOnAiBreach += 1;
    if (t.downed) s.executeKillRefund = true;
  }
  if (t.downed) return;

  const brk = armorBreakOf(a, sk);
  if (brk > 0 && !t.breached) {
    t.arm = Math.max(0, t.arm - brk);
    if (t.arm <= 0) setBreach(s, a, t, '破甲');
  }

  const kb = knockbackOf(a, sk);
  if (kb) {
    const push = simulatePush(s, a.x, a.y, t, kb, a.id);
    const moved = push.x !== t.x || push.y !== t.y;
    relocate(s, t, push.x, push.y);
    if (moved) log(s, `${t.name} 被击退`);
    if (push.collide) {
      const pct = a.passives.includes('job.impactForce') ? 0.15 : 0.1;
      log(s, `${t.name} 撞上${push.hitUnit ? push.hitUnit.name : '障碍'}，失衡！`);
      applyDamage(s, a, t, t.maxHp * pct);
      const other = push.hitUnit;
      if (other) applyDamage(s, a, other, other.maxHp * pct);
      if (!t.downed) setBreach(s, a, t, '撞击失衡');
      if (other && !other.downed && other.side !== a.side && a.passives.includes('job.chainImpact')) setBreach(s, a, other, '连锁冲击');
    }
  }

  if (sk.pull && !t.downed) {
    const d = dirTo(t.x, t.y, a.x, a.y);
    const [dx, dy] = DIRS[d];
    let [nx, ny] = [t.x, t.y];
    while (manhattan(nx, ny, a.x, a.y) > 1 && walkable(s, nx + dx, ny + dy, t.id)) {
      nx += dx;
      ny += dy;
    }
    relocate(s, t, nx, ny);
    log(s, `${t.name} 被拽到身前`);
  }

  if (sk.delay && !t.downed) {
    const amt = (1000 / t.spd) * sk.delay * (t.delayResist ? 0.5 : 1);
    t.nextActAt += amt;
    fx(s, 'text', t.id, '推迟');
    if (a.passives.includes('job.spotter') && t.side !== a.side) {
      t.spotted = true;
      log(s, `${a.name}【观测手】：${t.name} 被标定，族长对其伤害 +20%`);
    }
  }
}

/** Hits every adjacent enemy; knockback pushes each away from the caster. */
function novaStrike(s: BattleState, u: Unit, sk: SkillDef): boolean {
  const hits = opponents(s, u).filter((f) => manhattan(f.x, f.y, u.x, u.y) === 1);
  if (hits.length === 0) return false;
  log(s, `${u.name} 发动${sk.name}！`);
  for (const t of hits) if (!t.downed) strike(s, u, t, sk, { aoe: true });
  return true;
}

function applyTaunt(s: BattleState, u: Unit, t: Unit) {
  t.tauntedBy = u.id;
  fx(s, 'bubble', u.id, `${t.name}，冲我来！`);
  log(s, `${u.name} 挑衅 ${t.name}`);
}

/** Dispatch a targeted skill by kind. Returns false if nothing happened. */
function performSkill(s: BattleState, u: Unit, t: Unit, sk: SkillDef): boolean {
  if (sk.target === 'nova') return novaStrike(s, u, sk);
  if (sk.taunt) {
    applyTaunt(s, u, t);
    return true;
  }
  strike(s, u, t, sk);
  return true;
}

// ---------- player commands ----------

export type PlayerTarget = { targetId?: string; dir?: Dir; x?: number; y?: number };

export interface TargetOption {
  x: number;
  y: number;
  targetId?: string;
  dir?: Dir;
}

/** Valid clickable targets for a patriarch skill from the current position. */
export function skillTargets(s: BattleState, skillId: string): TargetOption[] {
  const u = getUnit(s, s.activeId);
  if (!u || s.turn.acted) return [];
  const sk = SKILLS[skillId];
  if (!skillReady(u, skillId)) return [];
  const foes = opponents(s, u);
  switch (sk.target) {
    case 'melee':
    case 'ray':
    case 'line':
    case 'dash':
    case 'enemyAny':
    case 'nova':
    case 'taunt':
      return foes.filter((f) => canTarget(s, u, u.x, u.y, f, sk)).map((f) => ({ x: f.x, y: f.y, targetId: f.id }));
    case 'sweep': {
      const out: TargetOption[] = [];
      for (const d of [0, 1, 2, 3] as Dir[]) {
        const tiles = sweepTiles(u.x, u.y, d);
        if (tiles.some(([x, y]) => inBounds(s, x, y) && foes.some((f) => f.x === x && f.y === y))) {
          for (const [x, y] of tiles) if (inBounds(s, x, y)) out.push({ x, y, dir: d });
        }
      }
      return out;
    }
    case 'blink': {
      if (s.turn.moved) return [];
      const out: TargetOption[] = [];
      for (let y = 0; y < s.h; y++)
        for (let x = 0; x < s.w; x++) {
          const d = manhattan(u.x, u.y, x, y);
          if (d >= 1 && d <= sk.range && walkable(s, x, y)) out.push({ x, y });
        }
      return out;
    }
    case 'self':
      return [{ x: u.x, y: u.y }];
  }
}

/** Free tile next to `t` where the patriarch lands for a lunge execution; nearest to the patriarch first. */
function lungeTile(s: BattleState, u: Unit, t: Unit): [number, number] | null {
  const tiles = DIRS.map(([dx, dy]) => [t.x + dx, t.y + dy] as [number, number]).filter(([x, y]) => walkable(s, x, y, u.id));
  tiles.sort((a, b) => manhattan(u.x, u.y, a[0], a[1]) - manhattan(u.x, u.y, b[0], b[1]));
  return tiles[0] ?? null;
}

function canExecute(s: BattleState, u: Unit, t: Unit): boolean {
  if (!t.breached) return false;
  const d = manhattan(u.x, u.y, t.x, t.y);
  if (d === 1) return true;
  return u.passives.includes('bloodLunge') && d <= BAL.bloodLungeRange && !!lungeTile(s, u, t);
}

export function executeTargets(s: BattleState): TargetOption[] {
  const u = getUnit(s, s.activeId);
  if (!u || s.turn.acted || u.kind !== 'patriarch') return [];
  return opponents(s, u)
    .filter((f) => canExecute(s, u, f))
    .map((f) => ({ x: f.x, y: f.y, targetId: f.id }));
}

function useSkill(s: BattleState, u: Unit, skillId: string, tgt: PlayerTarget): boolean {
  const sk = SKILLS[skillId];
  switch (sk.target) {
    case 'melee':
    case 'ray':
    case 'line':
    case 'nova':
    case 'taunt': {
      const t = getUnit(s, tgt.targetId);
      if (!t || !canTarget(s, u, u.x, u.y, t, sk)) return false;
      if (!performSkill(s, u, t, sk)) return false;
      break;
    }
    case 'dash': {
      const t = getUnit(s, tgt.targetId);
      if (!t || !canTarget(s, u, u.x, u.y, t, sk)) return false;
      const d = dirTo(u.x, u.y, t.x, t.y);
      const [dx, dy] = DIRS[d];
      relocate(s, u, t.x - dx, t.y - dy);
      u.facing = d;
      log(s, `${u.name} 突进！`);
      strike(s, u, t, sk);
      break;
    }
    case 'sweep': {
      if (tgt.dir === undefined) return false;
      u.facing = tgt.dir;
      const hits = sweepTiles(u.x, u.y, tgt.dir)
        .map(([x, y]) => unitAt(s, x, y))
        .filter((t): t is Unit => !!t && t.side !== u.side);
      if (hits.length === 0) return false;
      for (const t of hits) strike(s, u, t, sk);
      break;
    }
    case 'blink': {
      if (tgt.x === undefined || tgt.y === undefined || s.turn.moved) return false;
      if (!walkable(s, tgt.x, tgt.y) || manhattan(u.x, u.y, tgt.x, tgt.y) > sk.range) return false;
      u.x = tgt.x;
      u.y = tgt.y;
      u.nextAttackBonus = sk.nextAttackBonus ?? 0;
      s.turn.moved = true;
      setCooldown(u, skillId);
      log(s, `${u.name} 化作夜幕，瞬移至 (${u.x},${u.y})`);
      return true;
    }
    case 'enemyAny': {
      const t = getUnit(s, tgt.targetId);
      if (!t || t.side === u.side) return false;
      for (const c of alive(s)) if (c.kind === 'child') c.order = { kind: 'focus', targetId: t.id };
      fx(s, 'bubble', u.id, `集火 ${t.name}！`);
      log(s, `${u.name} 下令集火 ${t.name}`);
      break;
    }
    case 'self': {
      for (const c of alive(s))
        if (c.kind === 'child') {
          c.order = { kind: 'hold' };
          c.holdDamageCut = true;
        }
      fx(s, 'bubble', u.id, '死守阵线！');
      log(s, `${u.name} 下令死守`);
      break;
    }
  }
  setCooldown(u, skillId);
  s.turn.acted = true;
  return true;
}

export function playerSkill(s: BattleState, skillId: string, tgt: PlayerTarget): boolean {
  const u = getUnit(s, s.activeId);
  if (!u || u.kind !== 'patriarch' || s.turn.acted || !skillReady(u, skillId)) return false;
  const ok = useSkill(s, u, skillId, tgt);
  if (ok) checkResult(s);
  return ok;
}

export function playerExecute(s: BattleState, targetId: string): boolean {
  const u = getUnit(s, s.activeId);
  const t = getUnit(s, targetId);
  if (!u || !t || s.turn.acted || u.kind !== 'patriarch' || !canExecute(s, u, t)) return false;
  if (manhattan(u.x, u.y, t.x, t.y) !== 1) {
    const [x, y] = lungeTile(s, u, t)!;
    u.x = x;
    u.y = y;
    s.turn.moved = true;
    fx(s, 'text', u.id, '闪现!');
    log(s, `${u.name}【血影闪现】至 ${t.name} 身旁`);
  }
  u.facing = dirTo(u.x, u.y, t.x, t.y);
  strike(s, u, t, SKILLS.basic, { execution: true });
  s.turn.acted = true;
  hasteAllies(s, u);
  checkResult(s);
  return true;
}

/** A successful execution pulls every ally's next action forward, but never before the current moment. */
function hasteAllies(s: BattleState, pat: Unit) {
  const now = pat.nextActAt;
  let any = false;
  for (const c of alive(s)) {
    if (c.side !== pat.side || c.id === pat.id) continue;
    c.nextActAt = Math.max(now, c.nextActAt - (1000 / c.spd) * BAL.executionHaste);
    any = true;
  }
  if (any) log(s, `处决震慑全场：队友行动提前 ${Math.round(BAL.executionHaste * 100)}%`);
}

export function playerDefend(s: BattleState) {
  const u = getUnit(s, s.activeId);
  if (!u || s.turn.acted) return;
  u.defending = true;
  s.defendedThisTurn = true;
  s.turn.acted = true;
  log(s, `${u.name} 摆出防御姿态`);
  endTurn(s);
}

export function setStance(s: BattleState, st: Stance) {
  if (s.stance !== st) {
    s.stance = st;
    s.stanceSwitches += 1;
  }
}

// ---------- AI turns ----------

function bark(s: BattleState, u: Unit, intent: Intent) {
  if (u.kind !== 'child' || !u.personality) return;
  const lines = BARKS[u.personality][intent];
  if (!lines || lines.length === 0) return;
  withRng(s, (rng) => {
    if (rng.chance(0.6)) fx(s, 'bubble', u.id, rng.pick(lines));
  });
}

function aiStandardTurn(s: BattleState, u: Unit) {
  const slack = u.kind === 'child' && u.suspicion >= 80 && withRng(s, (rng) => rng.chance(0.1));
  if (slack) {
    withRng(s, (rng) => fx(s, 'bubble', u.id, rng.pick(SLACK_BARKS)));
    log(s, `${u.name} 消极怠工（疑心 ${u.suspicion}）`);
    s.decisions.push({ seq: ++s.aiSeq, unitId: u.id, unitName: u.name, top: [], heat: {}, from: [u.x, u.y], slacked: true });
    return;
  }
  const d = withRng(s, (rng) => decide(s, u, rng));
  s.decisions.push({ seq: ++s.aiSeq, unitId: u.id, unitName: u.name, top: d.top, heat: d.heat, from: [u.x, u.y], slacked: false });
  if (s.decisions.length > 60) s.decisions.splice(0, s.decisions.length - 60);
  const c = d.chosen.cand;
  const intent = d.chosen.mainIntent;
  const tally = s.tally[u.id];
  tally.intents[intent] = (tally.intents[intent] ?? 0) + 1;

  moveAlong(s, u, c.path);
  if (c.path.length > 1) s.turn.moved = true;
  if (intent === 'retreat') s.retreatWatch[u.id] = true;
  bark(s, u, intent);

  const main = d.chosen.factors[0];
  if (u.kind === 'child' && main) {
    log(
      s,
      `· ${u.name} 决策【${d.chosen.label}】意图=${intent} 性格x${main.personality.toFixed(2)} 态势x${main.stance.toFixed(2)} 心理x${main.psyche.toFixed(2)}`,
    );
  }

  if (c.action === 'defend') {
    u.defending = true;
    s.defendedThisTurn = true;
    s.turn.acted = true;
    return;
  }
  if (c.action === 'skill' && c.skillId && c.targetId) {
    const t = getUnit(s, c.targetId);
    const sk = SKILLS[c.skillId];
    if (t && !t.downed && canTarget(s, u, u.x, u.y, t, sk) && performSkill(s, u, t, sk)) {
      setCooldown(u, c.skillId);
      s.turn.acted = true;
    }
  }
}

function bossTurn(s: BattleState, u: Unit) {
  const b = u.boss!;
  const pat = patriarchOf(s);
  const phase = b.step % 5;
  if (phase === 1 && b.crossTiles) {
    fx(s, 'bubble', u.id, '银焰十字——审判！');
    log(s, `${u.name} 释放【银焰十字】`);
    const tiles = b.crossTiles;
    b.crossTiles = null;
    for (const [x, y] of tiles) {
      const t = unitAt(s, x, y);
      if (t && t.side === 'ally') strike(s, u, t, SKILLS.basic, { multOverride: 1.5, aoe: true, fromBoss: true });
    }
    s.turn.acted = true;
    b.step += 1;
    return;
  }
  if (phase === 3 && b.markTarget) {
    const target = getUnit(s, b.markTarget);
    if (target && !target.downed) {
      const reach = reachable(s, u, effectiveMov(u));
      let best: [number, number][] | null = null;
      for (const path of reach.values()) {
        const [x, y] = path[path.length - 1];
        if (manhattan(x, y, target.x, target.y) === 1 && (!best || path.length < best.length)) best = path;
      }
      if (best) {
        moveAlong(s, u, best);
        fx(s, 'bubble', u.id, '处刑！');
        log(s, `${u.name} 执行【处刑宣告】`);
        strike(s, u, target, SKILLS.basic, { multOverride: 2.5, fromBoss: true });
        b.markTarget = null;
        s.turn.acted = true;
        b.step += 1;
        return;
      }
    } else {
      b.markTarget = null;
      b.step += 1;
    }
  }
  aiStandardTurn(s, u);
  if (phase === 0) {
    b.crossTiles = crossTiles(s, u.x, u.y, 2);
    fx(s, 'bubble', u.id, '银焰将净化一切……');
    log(s, `${u.name} 开始蓄力【银焰十字】（预警范围已标出）`);
    b.step += 1;
  } else if (phase === 2 && pat && !pat.downed) {
    b.markTarget = pat.id;
    fx(s, 'bubble', u.id, `处刑宣告：${pat.name}！`);
    log(s, `${u.name} 对 ${pat.name} 发出【处刑宣告】，下次行动将重击`);
    b.step += 1;
  } else if (phase === 1 || phase === 4) {
    b.step += 1;
  }
}

/** Run the active unit's AI turn (children and enemies). Returns false if it's the player's turn. */
export function runAiTurn(s: BattleState, opts: { autoPatriarch?: boolean } = {}): boolean {
  const u = getUnit(s, s.activeId);
  if (!u || s.result) return false;
  if (u.kind === 'patriarch' && !opts.autoPatriarch) return false;
  const exec = u.kind === 'patriarch' ? executeTargets(s) : [];
  if (exec.length > 0 && exec[0].targetId) playerExecute(s, exec[0].targetId);
  else if (u.isBoss) bossTurn(s, u);
  else aiStandardTurn(s, u);
  checkResult(s);
  endTurn(s);
  return true;
}

export function playerEndTurn(s: BattleState) {
  if (!isPlayerTurn(s)) return;
  endTurn(s);
}
