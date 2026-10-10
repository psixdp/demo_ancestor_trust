import { runAiTurn } from '../src/core/battle/engine';
import { continueRun, finishBattle, settleRun, startRun, type RunState } from '../src/core/meta/expedition';
import { children, patriarch } from '../src/core/meta/growth';
import { advanceMonth } from '../src/core/meta/month';
import { createNewGame } from '../src/core/meta/newGame';
import { possess, possessionCandidates } from '../src/core/meta/actions';
import { isAdult } from '../src/core/character';
import type { GameState } from '../src/core/types';

function playBattle(run: RunState) {
  const b = run.battle!;
  let guard = 0;
  while (!b.result && guard++ < 2000) runAiTurn(b, { autoPatriarch: true });
  expect(b.result).not.toBeNull();
}

function playRun(g: GameState): RunState {
  const team = children(g).filter(isAdult).slice(0, 2).map((c) => c.id);
  const r = startRun(g, team, 1);
  if (!r.ok) throw new Error(r.msg);
  const run = r.run;
  for (;;) {
    playBattle(run);
    finishBattle(g, run);
    if (run.phase === 'done') break;
    continueRun(g, run);
  }
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

  it('a 24-month loop with runs and possession stays consistent', () => {
    const g = createNewGame(42);
    for (let i = 0; i < 24 && !g.gameOver; i++) {
      if (i % 2 === 0) playRun(g);
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
