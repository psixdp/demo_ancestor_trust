import { BAL, PERSONALITY_MOD } from '../src/config/balance';
import {
  TUNING_FIELDS,
  defaultValue,
  exportTuning,
  getOverrides,
  importTuning,
  numericLeaves,
  resetAll,
  resetField,
  resetGroup,
  setValue,
} from '../src/config/tuning';

afterEach(() => resetAll());

describe('tuning', () => {
  it('every numeric value in BAL and the AI tables has a labelled field', () => {
    const missing = numericLeaves().filter((p) => !TUNING_FIELDS[p]);
    expect(missing).toEqual([]);
    const stale = Object.keys(TUNING_FIELDS).filter((p) => typeof defaultValue(p) !== 'number');
    expect(stale).toEqual([]);
  });

  it('setValue mutates the live table and only stores differences', () => {
    expect(setValue('BAL.baseStats.hp', 150)).toBe(true);
    expect(BAL.baseStats.hp).toBe(150);
    expect(setValue('PERSONALITY_MOD.zealot.guard', 3)).toBe(true);
    expect(PERSONALITY_MOD.zealot.guard).toBe(3);
    expect(getOverrides()).toEqual({ 'BAL.baseStats.hp': 150, 'PERSONALITY_MOD.zealot.guard': 3 });

    setValue('BAL.baseStats.hp', 100);
    expect(getOverrides()).toEqual({ 'PERSONALITY_MOD.zealot.guard': 3 });
  });

  it('rejects unknown paths and non-finite numbers', () => {
    expect(setValue('BAL.nope', 1)).toBe(false);
    expect(setValue('PERSONALITY_MOD.zealot.defend', 1)).toBe(false);
    expect(setValue('BAL.startGold', Number.NaN)).toBe(false);
    expect(BAL.startGold).toBe(1500);
  });

  it('resets a field, a group, or everything', () => {
    setValue('BAL.startGold', 9999);
    setValue('BAL.upkeep', 1);
    setValue('BAL.livingCost', 2);
    resetField('BAL.startGold');
    expect(BAL.startGold).toBe(1500);
    resetGroup('economy');
    expect(BAL.upkeep).toBe(100);
    expect(BAL.livingCost).toBe(20);
    setValue('BAL.xpKill', 50);
    resetAll();
    expect(BAL.xpKill).toBe(5);
    expect(getOverrides()).toEqual({});
  });

  it('export and import round-trip, ignoring bad entries', () => {
    setValue('BAL.eventChance', 0.8);
    setValue('STANCE_MOD.assault.break', 2.5);
    const text = exportTuning();
    resetAll();

    const res = importTuning(text);
    expect(res).toEqual({ ok: true, applied: 2, ignored: 0 });
    expect(BAL.eventChance).toBe(0.8);

    const res2 = importTuning(JSON.stringify({ 'BAL.startGold': 2000, 'BAL.unknown': 1, 'BAL.upkeep': 'x' }));
    expect(res2).toEqual({ ok: true, applied: 1, ignored: 2 });
    expect(BAL.startGold).toBe(2000);
    expect(BAL.eventChance).toBe(0.4);

    expect(importTuning('{not json').ok).toBe(false);
  });
});
