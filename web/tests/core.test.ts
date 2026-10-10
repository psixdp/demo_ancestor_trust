import { possessionPreview } from '../src/core/character';
import { alleleName, breed, express, makeGenome, previewOffspring } from '../src/core/genetics';
import { createNewGame } from '../src/core/meta/newGame';
import { Rng } from '../src/core/rng';
import type { Genome } from '../src/core/types';

const base = (over: Partial<Record<keyof Genome, [string, string]>> = {}) =>
  makeGenome({
    L1: ['mundane', 'mundane'],
    L2: ['balanced', 'balanced'],
    L3: ['normalSpeed', 'normalSpeed'],
    L4: ['fang', 'fang'],
    L5: ['docile', 'docile'],
    L6: ['normalLife', 'normalLife'],
    ...over,
  });

describe('genetics', () => {
  it('higher-rank allele dominates', () => {
    const p = express(base({ L5: ['docile', 'zealot'] }));
    expect(p.personality).toBe('docile');
  });

  it('dormant alleles are not expressed', () => {
    const g = base({ L1: ['neuralWeb', 'mundane'] });
    expect(g.L1[0].dormant).toBe(true);
    expect(express(g).slots).toBe(2);
    g.L1[0].dormant = false;
    expect(express(g).slots).toBe(4);
  });

  it('heterozygous x heterozygous gives ~1/4 recessive homozygotes', () => {
    const a = base({ L5: ['docile', 'zealot'] });
    const b = base({ L5: ['docile', 'zealot'] });
    const prev = previewOffspring(a, b).L5;
    const zealot = prev.find((o) => o.label === alleleName('zealot'));
    expect(zealot?.prob).toBeCloseTo(0.25, 5);
    const rng = new Rng(7);
    let n = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) if (express(breed(a, b, rng)).personality === 'zealot') n++;
    expect(n / N).toBeGreaterThan(0.21);
    expect(n / N).toBeLessThan(0.29);
  });
});

describe('possession sync', () => {
  it('follows the doc formula', () => {
    const g = createNewGame(1);
    const c = g.members[1];
    c.devotion = 100;
    c.suspicion = 0;
    const pv = possessionPreview(c);
    expect(pv.sync).toBe(100);
    expect(pv.active).toBe(pv.slots);
    expect(pv.syncMul).toBeCloseTo(1, 5);
    c.devotion = 50;
    c.suspicion = 50;
    const pv2 = possessionPreview(c);
    expect(pv2.sync).toBe(40);
    expect(pv2.active).toBe(Math.max(1, Math.floor(pv2.slots * 0.7)));
  });
});
