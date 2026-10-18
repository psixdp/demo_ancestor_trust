import { autoRun, settleRun, startRun, type RunState } from '../src/core/meta/expedition';
import { children, patriarch } from '../src/core/meta/growth';
import { advanceMonth } from '../src/core/meta/month';
import { createNewGame } from '../src/core/meta/newGame';
import { changeClass, possess, possessionCandidates } from '../src/core/meta/actions';
import { CLASS_LIST } from '../src/config/classes';
import { isAdult } from '../src/core/character';
import type { GameState } from '../src/core/types';

function playRun(g: GameState): RunState {
  const team = children(g).filter(isAdult).slice(0, 2).map((c) => c.id);
  const r = startRun(g, team, 1);
  if (!r.ok) throw new Error(r.msg);
  const run = r.run;
  autoRun(g, run);
  expect(run.phase).toBe('done');
  settleRun(g, run);
  return run;
}

describe('headless simulation', () => {
  it('auto battles always terminate', () => {
    const outcomes: Record<string, number> = {};
    for (let seed = 1; seed <= 20; seed++) {
      const g = createNewGame(seed);
      const run = playRun(g);
      const k = `${run.outcome}@${run.floorsCleared}`;
      outcomes[k] = (outcomes[k] ?? 0) + 1;
      expect(g.month).toBe(2);
    }
    console.log('auto-run outcomes', outcomes);
    expect(Object.values(outcomes).reduce((a, b) => a + b, 0)).toBe(20);
  });

  it('teams with every class auto battle to an end', () => {
    for (let seed = 1; seed <= CLASS_LIST.length * 2; seed++) {
      const g = createNewGame(seed);
      const pick = (k: number) => CLASS_LIST[(seed + k) % CLASS_LIST.length].id;
      expect(changeClass(g, patriarch(g).id, pick(0)).ok).toBe(true);
      children(g)
        .filter(isAdult)
        .forEach((c, i) => expect(changeClass(g, c.id, pick(i + 1)).ok).toBe(true));
      playRun(g);
      expect(g.month).toBe(2);
    }
  });

  it('a 24-month loop with runs and possession stays consistent', () => {
    const g = createNewGame(42);
    for (let i = 0; i < 24 && !g.gameOver; i++) {
      // A defeat can leave no adult child; expedition requires one, so that month is skipped.
      children(g)
        .filter((c) => isAdult(c) && !c.classId)
        .forEach((c, k) => changeClass(g, c.id, CLASS_LIST[(i + k) % CLASS_LIST.length].id));
      if (i % 2 === 0 && children(g).some(isAdult)) playRun(g);
      else advanceMonth(g);
      g.pendingEvent = null;
      g.pendingTraitChoices = [];
      const pat = patriarch(g);
      expect(pat).toBeTruthy();
      if (i === 10) {
        const cand = possessionCandidates(g).sort((a, b) => b.sync - a.sync)[0];
        if (cand && cand.sync >= 20) {
          g.gold = Math.max(g.gold, 1000);
          const res = possess(g, cand.c.id, g.soul.pool.slice(0, cand.active));
          expect(res.ok).toBe(true);
          expect(patriarch(g).id).toBe(cand.c.id);
        }
      }
      for (const m of g.members) {
        expect(m.devotion).toBeGreaterThanOrEqual(0);
        expect(m.suspicion).toBeLessThanOrEqual(100);
        expect(m.traits.length).toBeLessThanOrEqual(4);
      }
    }
  });
});
