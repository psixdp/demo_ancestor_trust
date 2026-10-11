import { playerMove } from '../src/core/battle/engine';
import { key, reachable } from '../src/core/battle/rules';
import type { BattleState, Unit } from '../src/core/types';
import { board, unit } from './helpers';

/** A walled corridor on x=1 so the only route is straight through the occupant. */
function corridor(units: Unit[]): BattleState {
  const walls: [number, number][] = [];
  for (let y = 0; y < 4; y++) walls.push([0, y], [2, y]);
  return board(3, 4, units, walls);
}

describe('movement through allies', () => {
  it('can pass an ally and stop on the empty tile beyond, but not on the ally', () => {
    const pat = unit('pat', 'ally', 1, 3);
    const ally = unit('ally', 'ally', 1, 2);
    const s = corridor([pat, ally]);
    const reach = reachable(s, pat, 2);
    expect(reach.has(key(1, 2))).toBe(false);
    expect(reach.get(key(1, 1))).toEqual([
      [1, 3],
      [1, 2],
      [1, 1],
    ]);
    expect(reachable(s, pat, 1).has(key(1, 1))).toBe(false);
    expect(playerMove(s, 1, 2)).toBe(false);

    expect(playerMove(s, 1, 1)).toBe(true);
    expect(pat).toMatchObject({ x: 1, y: 1 });
    expect(ally).toMatchObject({ x: 1, y: 2 });
  });

  it('still cannot pass an enemy or an obstacle', () => {
    const pat = unit('pat', 'ally', 1, 3);
    const foe = unit('foe', 'enemy', 1, 2);
    const s = corridor([pat, foe]);
    const reach = reachable(s, pat, 3);
    expect(reach.has(key(1, 2))).toBe(false);
    expect(reach.has(key(1, 1))).toBe(false);
    expect(reach.has(key(1, 0))).toBe(false);
  });

  it('enemies cannot pass through allies', () => {
    const foe = unit('foe', 'enemy', 1, 0);
    const ally = unit('ally', 'ally', 1, 1);
    const s = corridor([foe, ally]);
    const reach = reachable(s, foe, 3);
    expect(reach.has(key(1, 1))).toBe(false);
    expect(reach.has(key(1, 2))).toBe(false);
  });
});
