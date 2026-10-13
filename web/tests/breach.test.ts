import { BAL } from '../src/config/balance';
import { createBattle, executeTargets, playerExecute, playerSkill } from '../src/core/battle/engine';
import { createNewGame } from '../src/core/meta/newGame';
import { unitFromCharacter } from '../src/core/meta/units';
import type { BattleState, Unit } from '../src/core/types';

/** Real battle state with the patriarch (c1) and Adrian (c2) against one enemy; the patriarch acts first. */
function duel(enemyAt: [number, number], patAt: [number, number] = [3, 5]): { s: BattleState; pat: Unit; ally: Unit; e: Unit } {
  const g = createNewGame(1);
  const allies = ['c1', 'c2'].map((id) => unitFromCharacter(g.members.find((m) => m.id === id)!, g.soul));
  const s = createBattle({ allies, floor: 1, difficulty: 1, seed: 1, stance: 'assault', intelTypes: [] });
  const e = s.units.find((u) => u.side === 'enemy')!;
  s.units = s.units.filter((u) => u.side === 'ally' || u === e);
  s.blocked.fill(false);
  const [pat, ally] = allies;
  [pat.x, pat.y] = patAt;
  [ally.x, ally.y] = [7, 7];
  [e.x, e.y] = enemyAt;
  e.eva = 0;
  e.facing = 0;
  pat.nextActAt = 10;
  ally.nextActAt = 30;
  e.nextActAt = 12;
  s.activeId = pat.id;
  s.turn = { moved: false, acted: false, startX: pat.x, startY: pat.y };
  return { s, pat, ally, e };
}

describe('breach and execution', () => {
  it('breaching wipes the target action progress', () => {
    const { s, pat, e } = duel([3, 4]);
    e.arm = 1;
    expect(playerSkill(s, 'basic', { targetId: e.id })).toBe(true);
    expect(e.breached).toBe(true);
    expect(e.nextActAt).toBeCloseTo(pat.nextActAt + 1000 / e.spd);
  });

  it('blood lunge executes a breached target up to the configured range', () => {
    const { s, pat, e } = duel([3, 1]);
    e.breached = true;
    expect(executeTargets(s).map((t) => t.targetId)).toEqual([e.id]);
    expect(playerExecute(s, e.id)).toBe(true);
    expect(Math.abs(pat.x - e.x) + Math.abs(pat.y - e.y) <= 1 || e.downed).toBe(true);
  });

  it('without blood lunge only adjacent targets can be executed', () => {
    const { s, pat, e } = duel([3, 1]);
    pat.passives = pat.passives.filter((p) => p !== 'bloodLunge');
    e.breached = true;
    expect(executeTargets(s)).toEqual([]);
    expect(playerExecute(s, e.id)).toBe(false);
  });

  it('a target beyond the lunge range cannot be executed', () => {
    const { s, e } = duel([3, 0], [3, 5]);
    e.breached = true;
    expect(executeTargets(s)).toEqual([]);
  });

  it('execution pulls allies forward but not before the current moment', () => {
    const { s, pat, ally, e } = duel([3, 4]);
    e.breached = true;
    const before = ally.nextActAt;
    expect(playerExecute(s, e.id)).toBe(true);
    expect(ally.nextActAt).toBeCloseTo(Math.max(pat.nextActAt, before - (1000 / ally.spd) * BAL.executionHaste));
    expect(ally.nextActAt).toBeGreaterThanOrEqual(pat.nextActAt);
  });
});
