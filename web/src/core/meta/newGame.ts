import { BAL } from '../../config/balance';
import { makeGenome } from '../genetics';
import { Rng } from '../rng';
import type { Character, GameState, Genome } from '../types';
import { refreshMarket } from './market';

function member(partial: Partial<Character> & { id: string; name: string; genome: Genome; ageMonths: number }): Character {
  return {
    generation: 2,
    traumas: [],
    wear: 0,
    parents: null,
    job: null,
    breedCooldown: 0,
    devotion: 30,
    suspicion: 0,
    stress: 0,
    experience: {},
    traits: [],
    shadows: [],
    declinedTraits: [],
    isPatriarch: false,
    syncMul: 1,
    activeSlots: 0,
    monthFlags: {},
    ...partial,
  };
}

export function createNewGame(seed: number): GameState {
  const rng = new Rng(seed);
  const patriarch = member({
    id: 'c1',
    name: '弗拉德',
    generation: 1,
    ageMonths: 20,
    isPatriarch: true,
    activeSlots: 2,
    genome: makeGenome({
      L1: ['mundane', 'wide'],
      L2: ['balanced', 'shadow'],
      L3: ['normalSpeed', 'swift'],
      L4: ['fang', 'ram'],
      L5: ['docile', 'zealot'],
      L6: ['normalLife', 'longevity'],
    }),
  });
  const adrian = member({
    id: 'c2',
    name: '艾德里安',
    ageMonths: 10,
    devotion: 60,
    suspicion: 10,
    stress: 20,
    job: 'mine',
    traits: ['selfShield'],
    experience: { intercepts: 3, mineMonths: 4 },
    parents: { family: 'c1', partner: '已故联姻对象' },
    genome: makeGenome({
      L1: ['wide', 'wide'],
      L2: ['balanced', 'balanced'],
      L3: ['normalSpeed', 'normalSpeed'],
      L4: ['ram', 'ram'],
      L5: ['zealot', 'zealot'],
      L6: ['normalLife', 'burn'],
    }),
  });
  const vera = member({
    id: 'c3',
    name: '薇拉',
    ageMonths: 8,
    devotion: 35,
    suspicion: 30,
    stress: 35,
    job: 'plasma',
    traits: ['survivor'],
    experience: { safeRetreats: 5, plasmaMonths: 2, breaches: 6 },
    parents: { family: 'c1', partner: '已故联姻对象' },
    genome: makeGenome({
      L1: ['mundane', 'wide'],
      L2: ['shadow', 'shadow'],
      L3: ['swift', 'swift'],
      L4: ['acid', 'acid'],
      L5: ['paranoid', 'zealot'],
      L6: ['longevity', 'normalLife'],
    }),
  });
  const luca = member({
    id: 'c4',
    name: '卢卡',
    ageMonths: 2,
    devotion: 30,
    experience: { trainings: 3 },
    parents: { family: 'c1', partner: '劳务派遣所合同工' },
    genome: makeGenome({
      L1: ['mundane', 'mundane'],
      L2: ['balanced', 'shadow'],
      L3: ['normalSpeed', 'swift'],
      L4: ['fang', 'acid'],
      L5: ['docile', 'paranoid'],
      L6: ['normalLife', 'normalLife'],
    }),
  });

  const g: GameState = {
    version: 1,
    seed,
    rngState: 0,
    month: 1,
    gold: BAL.startGold,
    mutagen: 0,
    tier: 'C',
    license: false,
    members: [patriarch, adrian, vera, luca],
    pregnancies: [],
    market: { labor: [], dwarf: [], elf: [], refreshIn: 3 },
    perks: { debtCollateral: false, workMonitor: false },
    soul: {
      soulXP: 0,
      pool: ['sweep', 'dash'],
      equipped: ['sweep', 'dash'],
      presets: { battle: ['sweep', 'dash'], work: [] },
      intel: {},
      stats: { battles: 0, defeats: 0, possessions: 0, bossKills: 0 },
    },
    mutation: null,
    monthFlags: { gala: false },
    reports: [{ month: 0, lines: ['血月投资集团成立。董事长弗拉德发表就职演说：“我们是一个大家庭。”'] }],
    pendingEvent: null,
    pendingTraitChoices: [],
    gameOver: null,
    nextId: 10,
    analytics: {
      battles: 0,
      aiBreaches: 0,
      executionsOnAiBreach: 0,
      intercepts: 0,
      intentCounts: {},
      stanceSwitches: 0,
      defeats: 0,
      possessions: [],
      psycheSpending: 0,
      informants: 0,
      defections: 0,
      breedings: 0,
      lostTraits: 0,
      stressAwaken: 0,
      stressShadow: 0,
    },
  };
  refreshMarket(g, rng);
  g.rngState = rng.state;
  return g;
}
