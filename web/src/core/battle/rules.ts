import { SKILLS, type SkillDef } from '../../config/skills';
import type { BattleState, Dir, Unit } from '../types';

export const DIRS: [number, number][] = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

export const key = (x: number, y: number) => `${x},${y}`;

export function inBounds(s: BattleState, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < s.w && y < s.h;
}

export function isObstacle(s: BattleState, x: number, y: number): boolean {
  return s.blocked[y * s.w + x];
}

export function alive(s: BattleState): Unit[] {
  return s.units.filter((u) => !u.downed);
}

export function unitAt(s: BattleState, x: number, y: number): Unit | undefined {
  return s.units.find((u) => !u.downed && u.x === x && u.y === y);
}

export function getUnit(s: BattleState, id: string | null | undefined): Unit | undefined {
  return id ? s.units.find((u) => u.id === id) : undefined;
}

export function patriarchOf(s: BattleState): Unit | undefined {
  return s.units.find((u) => u.kind === 'patriarch');
}

export function opponents(s: BattleState, u: Unit): Unit[] {
  return alive(s).filter((o) => o.side !== u.side);
}

export function manhattan(ax: number, ay: number, bx: number, by: number): number {
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

export function dirTo(fx: number, fy: number, tx: number, ty: number): Dir {
  const dx = tx - fx;
  const dy = ty - fy;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 1 : 3;
  return dy >= 0 ? 2 : 0;
}

export function walkable(s: BattleState, x: number, y: number, ignoreId?: string): boolean {
  if (!inBounds(s, x, y) || isObstacle(s, x, y)) return false;
  const u = unitAt(s, x, y);
  return !u || u.id === ignoreId;
}

/** BFS over 4 directions; units block movement (body blocking). Includes the start tile. */
export function reachable(s: BattleState, u: Unit, mov: number): Map<string, [number, number][]> {
  const res = new Map<string, [number, number][]>();
  res.set(key(u.x, u.y), [[u.x, u.y]]);
  let frontier: [number, number][] = [[u.x, u.y]];
  for (let step = 0; step < mov; step++) {
    const next: [number, number][] = [];
    for (const [x, y] of frontier) {
      const path = res.get(key(x, y))!;
      for (const [dx, dy] of DIRS) {
        const nx = x + dx;
        const ny = y + dy;
        if (res.has(key(nx, ny))) continue;
        if (!walkable(s, nx, ny, u.id)) continue;
        res.set(key(nx, ny), [...path, [nx, ny]]);
        next.push([nx, ny]);
      }
    }
    frontier = next;
  }
  return res;
}

/** Line of sight: obstacles on intermediate cells block the ray. Units do not. */
export function hasLos(s: BattleState, x0: number, y0: number, x1: number, y1: number): boolean {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  while (!(x === x1 && y === y1)) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    if (x === x1 && y === y1) break;
    if (isObstacle(s, x, y)) return false;
  }
  return true;
}

/** Straight line with every intermediate tile free of obstacles and units. */
export function clearLine(s: BattleState, x0: number, y0: number, x1: number, y1: number): boolean {
  if (x0 !== x1 && y0 !== y1) return false;
  const sx = Math.sign(x1 - x0);
  const sy = Math.sign(y1 - y0);
  let x = x0 + sx;
  let y = y0 + sy;
  while (!(x === x1 && y === y1)) {
    if (!walkable(s, x, y)) return false;
    x += sx;
    y += sy;
  }
  return true;
}

export function skillRange(sk: SkillDef): number {
  return sk.target === 'dash' ? sk.range + 1 : sk.range;
}

export function maxThreatRange(u: Unit): number {
  return Math.max(1, ...u.skills.map((s) => skillRange(SKILLS[s.id])).filter((r) => r < 50));
}

/** Can `u`, standing at (fx,fy), target `t` with skill `sk`? Only single-target kinds are handled here. */
export function canTarget(s: BattleState, u: Unit, fx: number, fy: number, t: Unit, sk: SkillDef): boolean {
  const d = manhattan(fx, fy, t.x, t.y);
  switch (sk.target) {
    case 'melee':
      return d === 1;
    case 'ray':
      return d >= 1 && d <= sk.range && hasLos(s, fx, fy, t.x, t.y);
    case 'line':
      return d >= 2 && d <= sk.range && clearLine(s, fx, fy, t.x, t.y);
    case 'dash':
      return d >= 2 && d <= sk.range + 1 && clearLine(s, fx, fy, t.x, t.y);
    case 'enemyAny':
      return t.side !== u.side;
    default:
      return false;
  }
}

export function skillReady(u: Unit, id: string): boolean {
  const st = u.skills.find((s) => s.id === id);
  return !!st && u.turnCount >= st.readyAt;
}

export function bossPresent(s: BattleState): boolean {
  return alive(s).some((u) => u.isBoss);
}

export function inCross(s: BattleState, x: number, y: number): boolean {
  return alive(s).some((u) => u.boss?.crossTiles?.some(([cx, cy]) => cx === x && cy === y));
}

export function effectiveAtk(s: BattleState, u: Unit): number {
  let atk = u.atk;
  if (u.passives.includes('bloodRage') && u.hp < u.maxHp * 0.3) atk *= 1.3;
  if (u.passives.includes('bossFear') && bossPresent(s)) atk *= 0.9;
  return atk * (1 + u.nextAttackBonus);
}

export function effectiveDef(u: Unit): number {
  let def = u.def;
  if (u.defending) def *= 1.5;
  if (u.breached) def *= 0.5;
  return def;
}

export function effectiveEva(u: Unit): number {
  let eva = u.eva;
  if (u.passives.includes('survivor') && u.hp < u.maxHp * 0.5) eva += 0.15;
  return eva;
}

export function effectiveMov(u: Unit): number {
  let mov = u.mov;
  if (u.passives.includes('tailCut') && u.hp < u.maxHp * 0.25) mov += 2;
  return mov;
}

export function isBackstab(fx: number, fy: number, t: Unit): boolean {
  return dirTo(fx, fy, t.x, t.y) === t.facing;
}

export interface DamageParts {
  raw: number;
  back: boolean;
}

/** Deterministic expected damage (no random roll, no hit check). */
export function estimateDamage(
  s: BattleState,
  a: Unit,
  t: Unit,
  mult: number,
  fx: number,
  fy: number,
  opts: { ignoreDef?: boolean } = {},
): DamageParts {
  const def = opts.ignoreDef ? 0 : effectiveDef(t);
  let dmg = Math.max(1, effectiveAtk(s, a) * mult - def);
  const back = isBackstab(fx, fy, t);
  if (back) dmg *= 1.5;
  if (a.kind === 'patriarch' && t.enemyType && s.intelTypes.includes(t.enemyType)) dmg *= 1.15;
  if (t.isBoss && a.passives.includes('faceJudgement')) dmg *= 1.15;
  if (t.passives.includes('traumaResist') && t.hp < t.maxHp * 0.5) dmg *= 0.85;
  if (t.holdDamageCut) dmg *= 0.7;
  return { raw: dmg, back };
}

export function armorBreakOf(u: Unit, sk: SkillDef): number {
  return sk.armorBreak * (u.passives.includes('breakExpert') ? 1.3 : 1);
}

/** Simulate knockback from attacker tile; returns final tile and whether it collides. */
export function simulatePush(
  s: BattleState,
  fx: number,
  fy: number,
  t: Unit,
  n: number,
  attackerId: string,
): { x: number; y: number; collide: boolean; hitUnit?: Unit } {
  const d = dirTo(fx, fy, t.x, t.y);
  const [dx, dy] = DIRS[d];
  let x = t.x;
  let y = t.y;
  for (let i = 0; i < n; i++) {
    const nx = x + dx;
    const ny = y + dy;
    if (!inBounds(s, nx, ny) || isObstacle(s, nx, ny)) return { x, y, collide: true };
    const other = unitAt(s, nx, ny);
    if (other && other.id !== t.id && !(other.id === attackerId && (nx !== fx || ny !== fy))) {
      return { x, y, collide: true, hitUnit: other };
    }
    x = nx;
    y = ny;
  }
  return { x, y, collide: false };
}

/** Rough normalized threat on a tile from all opponents of `side`. */
export function tileThreat(s: BattleState, side: Unit['side'], x: number, y: number, ignoreId?: string): number {
  let sum = 0;
  for (const o of alive(s)) {
    if (o.side === side || o.id === ignoreId) continue;
    const reach = effectiveMov(o) + maxThreatRange(o);
    if (manhattan(o.x, o.y, x, y) <= reach) sum += o.atk * (o.isBoss ? 1.5 : 1);
  }
  if (side === 'ally' && inCross(s, x, y)) sum += 40;
  return Math.min(1, sum / 60);
}

export function sweepTiles(x: number, y: number, d: Dir): [number, number][] {
  const [dx, dy] = DIRS[d];
  const fx = x + dx;
  const fy = y + dy;
  const [px, py] = DIRS[(d + 1) % 4];
  return [
    [fx, fy],
    [fx + px, fy + py],
    [fx - px, fy - py],
  ];
}

export function crossTiles(s: BattleState, x: number, y: number, r: number): [number, number][] {
  const out: [number, number][] = [];
  for (const [dx, dy] of DIRS) {
    for (let i = 1; i <= r; i++) {
      const nx = x + dx * i;
      const ny = y + dy * i;
      if (inBounds(s, nx, ny)) out.push([nx, ny]);
    }
  }
  return out;
}
