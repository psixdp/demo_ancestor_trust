import { BAL, PARTNER_SOURCES } from '../../config/balance';
import { PARTNER_NAMES } from '../../config/texts';
import { randomGenome } from '../genetics';
import type { Rng } from '../rng';
import type { GameState, Partner, PartnerSource } from '../types';
import { nextId } from './growth';

function makePartner(g: GameState, rng: Rng, source: PartnerSource): Partner {
  const genome = source === 'labor' ? randomGenome(rng, 'common', false) : randomGenome(rng, source, true);
  return {
    id: nextId(g, 'p'),
    name: rng.pick(PARTNER_NAMES[source]),
    source,
    genome,
    fee: PARTNER_SOURCES[source].fee,
  };
}

export function refreshMarket(g: GameState, rng: Rng) {
  const mk = (src: PartnerSource) => Array.from({ length: PARTNER_SOURCES[src].count }, () => makePartner(g, rng, src));
  g.market = { labor: mk('labor'), dwarf: mk('dwarf'), elf: mk('elf'), refreshIn: BAL.marketRefresh };
}
