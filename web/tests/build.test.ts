import { SKILLS } from '../src/config/skills';
import { armorBreakOf, canTarget, estimateDamage, knockbackOf, simulatePush } from '../src/core/battle/rules';
import { deriveStats } from '../src/core/character';
import { changeClass } from '../src/core/meta/actions';
import { createNewGame } from '../src/core/meta/newGame';
import { unitFromCharacter } from '../src/core/meta/units';
import { board, unit } from './helpers';

const byId = (g: ReturnType<typeof createNewGame>, id: string) => g.members.find((m) => m.id === id)!;

describe('character build', () => {
  it('stats stack base template, gene mods and class mods', () => {
    const g = createNewGame(1);
    const vera = deriveStats(byId(g, 'c3'), g.soul);
    // shadow x2, swift x2, paranoid dominates zealot (atkPct 0.1), breaker atk +2
    expect(vera).toMatchObject({ hp: 80, atk: 24, def: 5, arm: 20, spd: 120, mov: 4 });
    expect(vera.eva).toBeCloseTo(0.2);
    expect(vera.skills).toEqual(['acid']);
    expect(vera.passives).toContain('gene.acid');
    expect(vera.passives).toContain('job.exposeWeakness');
  });

  it('classless characters only have the basic attack', () => {
    const g = createNewGame(1);
    const luca = deriveStats(byId(g, 'c4'), g.soul);
    expect(luca.skills).toEqual([]);
    expect(luca.passives.every((p) => p.startsWith('gene.'))).toBe(true);
  });

  it('changing class swaps class skills and passive; minors cannot change', () => {
    const g = createNewGame(1);
    expect(changeClass(g, 'c2', 'bulwark').ok).toBe(true);
    const st = deriveStats(byId(g, 'c2'), g.soul);
    expect(st.skills).toEqual(['shieldBash', 'taunt']);
    expect(st.passives).toContain('job.bulwark');
    expect(st.passives).not.toContain('job.impactForce');
    expect(changeClass(g, 'c2', null).ok).toBe(true);
    expect(deriveStats(byId(g, 'c2'), g.soul).skills).toEqual([]);
    expect(changeClass(g, 'c4', 'charger').ok).toBe(false);
  });

  it('battle units get basic + class skills, and the patriarch adds equipped memories', () => {
    const g = createNewGame(1);
    changeClass(g, 'c1', 'hunter');
    const pat = unitFromCharacter(byId(g, 'c1'), g.soul);
    expect(pat.skills.map((s) => s.id)).toEqual(['basic', 'markShot', 'sweep', 'dash']);
    expect(pat.passives).toContain('job.spotter');
    const adrian = unitFromCharacter(byId(g, 'c2'), g.soul);
    expect(adrian.skills.map((s) => s.id)).toEqual(['basic', 'ram']);
  });

  it('gene passives modify class skills', () => {
    const ram = SKILLS.ram;
    expect(knockbackOf(unit('a', 'ally', 0, 0, { passives: ['gene.ram'] }), ram)).toBe(ram.knockback! + 1);
    expect(knockbackOf(unit('a', 'ally', 0, 0), ram)).toBe(ram.knockback);
    const acid = SKILLS.acid;
    expect(armorBreakOf(unit('a', 'ally', 0, 0, { passives: ['gene.acid'] }), acid)).toBeCloseTo(acid.armorBreak * 1.4);

    const t = unit('e', 'enemy', 0, 3, { passives: ['gene.forgeArm'] });
    const s = board(1, 6, [unit('a', 'ally', 0, 2), t]);
    expect(simulatePush(s, 0, 2, t, 2, 'a')).toMatchObject({ x: 0, y: 4 });
  });

  it('shadowShot ignores line of sight; markShot does not', () => {
    const a = unit('a', 'ally', 0, 0);
    const e = unit('e', 'enemy', 0, 2);
    const s = board(1, 3, [a, e], [[0, 1]]);
    expect(canTarget(s, a, 0, 0, e, SKILLS.shadowShot)).toBe(true);
    expect(canTarget(s, a, 0, 0, e, SKILLS.markShot)).toBe(false);
  });

  it('bulwark takes less damage and spotted targets take more from the patriarch', () => {
    const pat = unit('pat', 'ally', 0, 0, { atk: 30, facing: 2 });
    const e = unit('e', 'enemy', 0, 1, { facing: 2 });
    const s = board(1, 2, [pat, e]);
    const base = estimateDamage(s, pat, e, 1, 0, 0).raw;
    e.spotted = true;
    expect(estimateDamage(s, pat, e, 1, 0, 0).raw).toBeCloseTo(base * 1.2);
    e.spotted = false;
    e.passives = ['job.bulwark'];
    expect(estimateDamage(s, pat, e, 1, 0, 0).raw).toBeCloseTo(base * 0.9);
  });
});
