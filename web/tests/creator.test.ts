import { BAL } from '../src/config/balance';
import { deriveStats } from '../src/core/character';
import { possess } from '../src/core/meta/actions';
import { createCharacter, defaultTemplate, type CreatorSpec } from '../src/core/meta/characterCreator';
import { patriarch } from '../src/core/meta/growth';
import { advanceMonth } from '../src/core/meta/month';
import { createNewGame } from '../src/core/meta/newGame';

function spec(over: Partial<CreatorSpec> = {}): CreatorSpec {
  const g = createNewGame(1);
  return {
    name: '测试体',
    template: { id: 'tplTest', name: '重装', stats: { ...BAL.baseStats, hp: 200, atk: 40 } },
    genome: structuredClone(g.members[0].genome),
    classId: 'warden',
    traits: ['survivor'],
    shadows: ['jumpy'],
    ageMonths: BAL.adultAge,
    devotion: 100,
    suspicion: 0,
    stress: 0,
    ...over,
  };
}

describe('character creator', () => {
  it('applies the custom base template only to the created character', () => {
    const g = createNewGame(1);
    const res = createCharacter(g, spec());
    expect(res.ok).toBe(true);
    const c = g.members[g.members.length - 1];
    expect(c.baseTemplate?.name).toBe('重装');
    expect(c.classId).toBe('warden');
    expect(c.traits).toEqual(['survivor']);
    const withDefault = deriveStats({ ...c, baseTemplate: undefined }, g.soul);
    const withCustom = deriveStats(c, g.soul);
    expect(withCustom.hp).toBeGreaterThan(withDefault.hp);
    expect(withCustom.atk).toBeGreaterThan(withDefault.atk);
  });

  it('default template does not store a per-character template', () => {
    const g = createNewGame(1);
    createCharacter(g, spec({ template: defaultTemplate() }));
    expect(g.members[g.members.length - 1].baseTemplate).toBeUndefined();
  });

  it('rejects minors and too many traits', () => {
    const g = createNewGame(1);
    expect(createCharacter(g, spec({ ageMonths: 2 })).ok).toBe(false);
    expect(createCharacter(g, spec({ traits: ['survivor', 'selfShield', 'breakExpert', 'bloodthirst', 'executioner'] })).ok).toBe(false);
  });

  it('offspring and possessed bodies fall back to the default template', () => {
    const g = createNewGame(1);
    createCharacter(g, spec());
    const c = g.members[g.members.length - 1];
    g.pregnancies.push({ id: 'p1', familyId: c.id, familyName: c.name, partner: g.market.labor[0], monthsLeft: 1 });
    advanceMonth(g);
    const baby = g.members.find((m) => m.parents?.family === c.name);
    expect(baby).toBeTruthy();
    expect(baby!.baseTemplate).toBeUndefined();

    g.gold = 5000;
    expect(possess(g, c.id, []).ok).toBe(true);
    expect(patriarch(g).id).toBe(c.id);
    expect(patriarch(g).baseTemplate).toBeUndefined();
  });
});
