import { createBattle } from '../src/core/battle/engine';
import { deriveStats } from '../src/core/character';
import { finishBattle, moveTo, settleRun, startRun, takeStairs, useRest, type RunState } from '../src/core/meta/expedition';
import { generateFloor, neighbors, pathTo, roomAt, type FloorMap } from '../src/core/meta/floorMap';
import { memberById } from '../src/core/meta/growth';
import { createNewGame } from '../src/core/meta/newGame';
import { unitFromCharacter } from '../src/core/meta/units';
import { Rng } from '../src/core/rng';
import type { GameState } from '../src/core/types';

function reachable(map: FloorMap, from: number, blocked: (id: number) => boolean = () => false): Set<number> {
  const seen = new Set([from]);
  const queue = [from];
  while (queue.length) {
    for (const n of neighbors(map, queue.shift()!)) {
      if (seen.has(n) || blocked(n)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return seen;
}

describe('floor map', () => {
  it('is connected, the guard is the only way down and side rooms can be skipped', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const floor of [1, 2, 3, 4]) {
        const map = generateFloor(floor, new Rng(seed * 31 + floor));
        expect(map.rooms.length).toBeGreaterThanOrEqual(floor === 4 ? 5 : 6);
        expect(reachable(map, map.entryId).size).toBe(map.rooms.length);
        const gate = map.rooms.find((r) => r.kind === (floor === 4 ? 'boss' : 'guard'))!;
        expect(gate.enemies?.length).toBeGreaterThan(0);
        if (floor < 4) expect(reachable(map, map.entryId, (id) => id === gate.id).has(map.exitId)).toBe(false);
        const noSide = pathTo(map, map.entryId, map.exitId, (r) => r.kind === 'side');
        expect(noSide).not.toBeNull();
        expect(map.rooms.filter((r) => r.kind === 'rest')).toHaveLength(1);
        expect(roomAt(map, map.entryId).visited).toBe(true);
      }
    }
  });
});

describe('initiative', () => {
  function firstSide(initiative: 'ally' | 'enemy') {
    const g = createNewGame(3);
    const allies = ['c1', 'c2', 'c3'].map((id) => unitFromCharacter(memberById(g, id)!, g.soul));
    const b = createBattle({ allies, floor: 1, difficulty: 1, seed: 99, stance: 'assault', intelTypes: [], enemyTypes: ['rat', 'rat'], initiative });
    return b.units.find((u) => u.id === b.activeId)!.side;
  }
  it('the side with initiative opens the fight', () => {
    expect(firstSide('ally')).toBe('ally');
    expect(firstSide('enemy')).toBe('enemy');
  });
});

function begin(g: GameState): RunState {
  const r = startRun(g, ['c2', 'c3'], 1);
  if (!r.ok) throw new Error(r.msg);
  return r.run;
}

/** Walks toward the guard until a fight starts. */
function walkIntoFight(g: GameState, run: RunState) {
  for (let i = 0; i < 10 && run.phase === 'explore'; i++) {
    const guard = run.map.rooms.find((r) => r.kind === 'guard')!;
    moveTo(g, run, pathTo(run.map, run.roomId, guard.id)![1]);
  }
  expect(run.phase).toBe('battle');
}

/** Ends the current fight as a win with c2 knocked down. */
function winWithC2Down(run: RunState) {
  const b = run.battle!;
  const c2 = b.units.find((u) => u.id === 'c2')!;
  c2.hp = 0;
  c2.downed = true;
  b.tally.c2.downed = true;
  for (const u of b.units) if (u.side === 'enemy') u.downed = true;
  b.result = 'victory';
}

describe('downed children', () => {
  it('stay down without 血契唤醒', () => {
    const g = createNewGame(5);
    const run = begin(g);
    walkIntoFight(g, run);
    winWithC2Down(run);
    finishBattle(g, run);
    expect(run.phase).toBe('explore');
    expect(run.downed).toContain('c2');
  });

  it('get back up at 30% under 血契唤醒 and still take the trauma', () => {
    const g = createNewGame(5);
    g.soul.pool.push('bloodPact');
    g.soul.equipped = ['sweep', 'bloodLunge', 'bloodPact'];
    const run = begin(g);
    walkIntoFight(g, run);
    winWithC2Down(run);
    finishBattle(g, run);
    const max = deriveStats(memberById(g, 'c2')!, g.soul).hp;
    expect(run.downed).not.toContain('c2');
    expect(run.hp.c2).toBe(Math.round(max * 0.3));
    const traumas = memberById(g, 'c2')!.traumas.length;
    run.phase = 'done';
    run.outcome = 'retreat';
    settleRun(g, run);
    expect(memberById(g, 'c2')!.traumas.length).toBe(traumas + 1);
  });
});

describe('blood bags and rest', () => {
  it('blood bags need someone at the plasma station', () => {
    const g = createNewGame(7);
    for (const m of g.members) m.job = null;
    expect(startRun(g, ['c2'], 1, 2).ok).toBe(false);
    memberById(g, 'c3')!.job = 'plasma';
    const gold = g.gold;
    const r = startRun(g, ['c2'], 1, 2);
    expect(r.ok).toBe(true);
    expect(g.gold).toBe(gold - 60);
  });

  it('a rest point heals once and the stairs lead down', () => {
    const g = createNewGame(9);
    const run = begin(g);
    run.map.patrol = null;
    for (const r of run.map.rooms) if (r.kind === 'guard') r.enemies = null;
    run.hp.c1 = 10;
    const rest = run.map.rooms.find((r) => r.kind === 'rest')!;
    for (const id of pathTo(run.map, run.roomId, rest.id)!.slice(1)) moveTo(g, run, id);
    expect(useRest(g, run)).toBe(true);
    expect(run.hp.c1).toBeGreaterThan(10);
    expect(useRest(g, run)).toBe(false);
    for (const id of pathTo(run.map, run.roomId, run.map.exitId)!.slice(1)) moveTo(g, run, id);
    expect(takeStairs(g, run)).toBe(true);
    expect(run.floor).toBe(2);
    expect(run.roomId).toBe(run.map.entryId);
  });
});
