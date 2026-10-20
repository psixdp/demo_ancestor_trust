import { BAL } from '../../config/balance';
import { ENCOUNTERS, LAYOUTS, PATROLS, SIDE_ENCOUNTERS, type EnemyGroup } from '../../config/enemies';
import type { Rng } from '../rng';

export type RoomKind = 'entry' | 'empty' | 'guard' | 'side' | 'rest' | 'stairs' | 'boss';

export interface Room {
  /** slot index, y * MAP_W + x */
  id: number;
  x: number;
  y: number;
  kind: RoomKind;
  /** enemies still holding the room; null once cleared or for rooms without enemies */
  enemies: string[] | null;
  /** index into LAYOUTS, used when a fight breaks out here */
  layout: number;
  visited: boolean;
  /** rest point drunk or chest opened */
  used: boolean;
}

export interface Patrol {
  roomId: number;
  enemies: string[];
}

export interface FloorMap {
  floor: number;
  rooms: Room[];
  links: [number, number][];
  entryId: number;
  /** stairs room, or the boss room on the last floor */
  exitId: number;
  patrol: Patrol | null;
}

export const MAP_W = 3;
export const MAP_H = 3;
export const LAST_FLOOR = 4;

export const ROOM_NAMES: Record<RoomKind, string> = {
  entry: '入口',
  empty: '空房',
  guard: '守卫',
  side: '敌群·宝箱',
  rest: '血库残罐',
  stairs: '下层楼梯',
  boss: '审判庭',
};

export function rollGroup(rng: Rng, groups: EnemyGroup[]): string[] {
  const out: string[] = [];
  for (const [type, min, max] of rng.pick(groups)) {
    const n = rng.int(min, max);
    for (let i = 0; i < n; i++) out.push(type);
  }
  return out;
}

function slotNeighbors(id: number): number[] {
  const x = id % MAP_W;
  const y = Math.floor(id / MAP_W);
  const out: number[] = [];
  if (x > 0) out.push(id - 1);
  if (x < MAP_W - 1) out.push(id + 1);
  if (y > 0) out.push(id - MAP_W);
  if (y < MAP_H - 1) out.push(id + MAP_W);
  return out;
}

export function linked(map: FloorMap, a: number, b: number): boolean {
  return map.links.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
}

export function neighbors(map: FloorMap, id: number): number[] {
  return map.links.flatMap(([p, q]) => (p === id ? [q] : q === id ? [p] : []));
}

export function roomAt(map: FloorMap, id: number): Room {
  return map.rooms.find((r) => r.id === id)!;
}

/** Shortest room path from `from` to `to`, both ends included; `avoid` rooms are never entered. */
export function pathTo(map: FloorMap, from: number, to: number, avoid: (r: Room) => boolean = () => false): number[] | null {
  const prev = new Map<number, number>([[from, -1]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift()!;
    if (cur === to) break;
    for (const n of neighbors(map, cur)) {
      if (prev.has(n) || (n !== to && avoid(roomAt(map, n)))) continue;
      prev.set(n, cur);
      queue.push(n);
    }
  }
  if (!prev.has(to)) return null;
  const path = [to];
  while (path[0] !== from) path.unshift(prev.get(path[0])!);
  return path;
}

export function visit(map: FloorMap, id: number) {
  roomAt(map, id).visited = true;
}

function tryGenerate(floor: number, rng: Rng): FloorMap | null {
  const last = floor >= LAST_FLOOR;
  const pathKinds: RoomKind[] = last ? ['entry', 'empty', 'boss'] : ['entry', 'empty', 'guard', 'stairs'];
  const used = new Set<number>();
  const path = [rng.pick([6, 7, 8])];
  used.add(path[0]);
  while (path.length < pathKinds.length) {
    const free = slotNeighbors(path[path.length - 1]).filter((n) => !used.has(n));
    if (free.length === 0) return null;
    const n = rng.pick(free);
    path.push(n);
    used.add(n);
  }
  const kinds = new Map<number, RoomKind>(path.map((id, i) => [id, pathKinds[i]]));
  const links: [number, number][] = [];
  for (let i = 1; i < path.length; i++) links.push([path[i - 1], path[i]]);

  // Branches hang off the rooms before the guard, so the guard stays the only way down.
  const branchKinds: RoomKind[] = last ? ['rest', 'side'] : ['rest', 'side', ...(rng.chance(0.5) ? (['side'] as RoomKind[]) : [])];
  for (const kind of branchKinds) {
    const anchors = [...kinds.entries()]
      .filter(([, k]) => k === 'entry' || k === 'empty' || k === 'rest')
      .flatMap(([id]) => slotNeighbors(id).filter((n) => !used.has(n)).map((n) => [id, n] as const));
    if (anchors.length === 0) return null;
    const [from, to] = rng.pick(anchors);
    kinds.set(to, kind);
    used.add(to);
    links.push([from, to]);
  }

  const rooms: Room[] = [...kinds.entries()].map(([id, kind]) => {
    let enemies: string[] | null = null;
    if (kind === 'guard' || kind === 'boss') enemies = rollGroup(rng, ENCOUNTERS[floor]);
    if (kind === 'side') enemies = rollGroup(rng, SIDE_ENCOUNTERS[floor]);
    return {
      id,
      x: id % MAP_W,
      y: Math.floor(id / MAP_W),
      kind,
      enemies,
      layout: rng.int(0, LAYOUTS.length - 1),
      visited: false,
      used: false,
    };
  });
  const map: FloorMap = { floor, rooms, links, entryId: path[0], exitId: path[path.length - 1], patrol: null };

  const beats = rooms.filter((r) => r.kind === 'empty' || r.kind === 'rest');
  if (PATROLS[floor] && beats.length) map.patrol = { roomId: rng.pick(beats).id, enemies: rollGroup(rng, PATROLS[floor]) };
  visit(map, map.entryId);
  return map;
}

export function generateFloor(floor: number, rng: Rng): FloorMap {
  for (;;) {
    const map = tryGenerate(floor, rng);
    if (map) return map;
  }
}

/** Rooms a patrol may walk into: no standing enemies and not past the guard. */
function patrolCanEnter(r: Room): boolean {
  return !r.enemies && r.kind !== 'stairs' && r.kind !== 'guard' && r.kind !== 'boss';
}

/** Moves the patrol one room every `BAL.patrolEvery` steps. Returns true if it moved. */
export function stepPatrol(map: FloorMap, steps: number, rng: Rng): boolean {
  const p = map.patrol;
  if (!p || steps % Math.max(1, BAL.patrolEvery) !== 0) return false;
  const options = neighbors(map, p.roomId).filter((n) => patrolCanEnter(roomAt(map, n)));
  if (options.length === 0) return false;
  p.roomId = rng.pick(options);
  return true;
}
