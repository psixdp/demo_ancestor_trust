import { ALLELES, genePassiveId } from './alleles';
import { CLASS_LIST } from './classes';
import { MEMORIES } from './memories';
import type { LocusId } from '../core/types';

export type PassiveSource = 'gene' | 'job' | 'acquired' | 'memory';

export const PASSIVE_SOURCE_NAMES: Record<PassiveSource, string> = {
  gene: '基因',
  job: '职业',
  acquired: '后天',
  memory: '记忆',
};

export interface PassiveInfo {
  id: string;
  name: string;
  desc: string;
  source: PassiveSource;
  /** gene passives only */
  locus?: LocusId;
  shadow?: boolean;
}

const TABLE: Record<string, PassiveInfo> = {};
for (const a of ALLELES) {
  const id = genePassiveId(a.id);
  TABLE[id] = { id, name: a.name, desc: a.desc, source: 'gene', locus: a.locus };
}
for (const c of CLASS_LIST) TABLE[c.passive] = { id: c.passive, name: c.passiveName, desc: c.passiveDesc, source: 'job' };

/** Acquired traits and soul memories share ids: a trait becomes a memory when its holder is possessed. */
export function passiveInfo(id: string, isPatriarch = false): PassiveInfo {
  const t = TABLE[id];
  if (t) return t;
  const m = MEMORIES[id];
  if (m) return { id, name: m.name, desc: m.desc, source: isPatriarch ? 'memory' : 'acquired', shadow: m.source === 'shadow' };
  return { id, name: id, desc: '', source: 'acquired' };
}
