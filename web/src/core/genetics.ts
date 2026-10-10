import { ALLELE_MAP, LOCUS_DEFAULT, allelesOf, type AlleleDef, type AlleleSource } from '../config/alleles';
import type { Rng } from './rng';
import { LOCI, type AlleleInstance, type Genome, type LocusId, type Phenotype } from './types';

/** Alleles on a locus that participate in expression (dormant ones are treated as absent). */
function expressedOnLocus(pair: [AlleleInstance, AlleleInstance], locus: LocusId): AlleleDef[] {
  const active = pair.filter((a) => !a.dormant).map((a) => ALLELE_MAP[a.id]);
  if (active.length === 0) return [ALLELE_MAP[LOCUS_DEFAULT[locus]]];
  const top = Math.max(...active.map((a) => a.rank));
  const winners = active.filter((a) => a.rank === top);
  // identical alleles collapse to one; equal-rank different alleles are co-dominant
  const unique: AlleleDef[] = [];
  for (const w of winners) if (!unique.some((u) => u.id === w.id)) unique.push(w);
  return unique;
}

function avg(defs: AlleleDef[], key: keyof AlleleDef, fallback: number): number {
  const vals = defs.map((d) => d[key]).filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return fallback;
  return vals.reduce((s, v) => s + v, 0) / vals.length;
}

export function express(genome: Genome): Phenotype {
  const ex = {} as Record<LocusId, AlleleDef[]>;
  for (const l of LOCI) ex[l] = expressedOnLocus(genome[l], l);

  const skills: string[] = [];
  for (const d of ex.L4) if (d.skill && !skills.includes(d.skill)) skills.push(d.skill);

  const atkMul = avg(ex.L5, 'atkMul', 1) * avg(ex.L6, 'atkMul', 1);

  return {
    slots: Math.round(avg(ex.L1, 'slots', 2)),
    hp: Math.round(avg(ex.L2, 'hp', 100)),
    def: Math.round(avg(ex.L2, 'def', 10)),
    arm: Math.round(avg(ex.L2, 'arm', 30)),
    mov: Math.round(avg(ex.L2, 'mov', 3)),
    eva: avg(ex.L2, 'eva', 0.05),
    spd: Math.round(avg(ex.L3, 'spd', 100)),
    delayResist: ex.L3.some((d) => d.delayResist),
    skills,
    personality: ex.L5[0].personality ?? 'docile',
    devotionMul: avg(ex.L5, 'devotionMul', 1),
    suspicionMul: avg(ex.L5, 'suspicionMul', 1),
    atkMul,
    agingStart: Math.round(avg(ex.L6, 'agingStart', 36)),
    expressed: Object.fromEntries(LOCI.map((l) => [l, ex[l].map((d) => d.id)])) as Record<LocusId, string[]>,
  };
}

export function alleleName(id: string): string {
  return ALLELE_MAP[id]?.name ?? id;
}

export function locusLabel(genome: Genome, locus: LocusId): string {
  return express(genome).expressed[locus].map(alleleName).join('+');
}

function inst(id: string): AlleleInstance {
  return { id, dormant: !!ALLELE_MAP[id].dormantAtBirth };
}

/** Each parent contributes one random allele per locus. Dormant-at-birth alleles are re-dormant in the child. */
export function breed(a: Genome, b: Genome, rng: Rng): Genome {
  const g = {} as Genome;
  for (const l of LOCI) {
    const fromA = a[l][rng.int(0, 1)];
    const fromB = b[l][rng.int(0, 1)];
    g[l] = [inst(fromA.id), inst(fromB.id)];
  }
  return g;
}

export interface OutcomeProb {
  label: string;
  prob: number;
  dormantNote: boolean;
}

/** Phenotype probabilities per locus, computed from the 2x2 combinations, as expressed at birth. */
export function previewOffspring(a: Genome, b: Genome): Record<LocusId, OutcomeProb[]> {
  const out = {} as Record<LocusId, OutcomeProb[]>;
  for (const l of LOCI) {
    const map = new Map<string, OutcomeProb>();
    for (const x of a[l]) {
      for (const y of b[l]) {
        const pair: [AlleleInstance, AlleleInstance] = [inst(x.id), inst(y.id)];
        const label = expressedOnLocus(pair, l).map((d) => d.name).join('+');
        const dormantNote = pair.some((p) => p.dormant);
        const key = label + (dormantNote ? '*' : '');
        const cur = map.get(key) ?? { label, prob: 0, dormantNote };
        cur.prob += 0.25;
        map.set(key, cur);
      }
    }
    out[l] = [...map.values()].sort((p, q) => q.prob - p.prob);
  }
  return out;
}

export function randomGenome(rng: Rng, source: AlleleSource | 'common', guaranteeExotic: boolean): Genome {
  const g = {} as Genome;
  for (const l of LOCI) {
    const pool = allelesOf(l, 'common');
    g[l] = [inst(rng.pick(pool).id), inst(rng.pick(pool).id)];
  }
  if (source !== 'common' && guaranteeExotic) {
    const exoticLoci = LOCI.filter((l) => allelesOf(l, source).length > 0);
    rng.shuffle(exoticLoci);
    const count = rng.int(1, Math.min(2, exoticLoci.length));
    for (let i = 0; i < count; i++) {
      const l = exoticLoci[i];
      const allele = rng.pick(allelesOf(l, source));
      g[l][rng.int(0, 1)] = inst(allele.id);
    }
  }
  return g;
}

/** Replace one allele with a different common allele of the same locus. */
export function mutateAllele(genome: Genome, locus: LocusId, index: 0 | 1, rng: Rng): string {
  const current = genome[locus][index].id;
  const choices = allelesOf(locus, 'common').filter((a) => a.id !== current);
  const pick = rng.pick(choices);
  genome[locus][index] = { id: pick.id, dormant: false };
  return pick.id;
}

export function makeGenome(spec: Record<LocusId, [string, string]>): Genome {
  const g = {} as Genome;
  for (const l of LOCI) g[l] = [inst(spec[l][0]), inst(spec[l][1])];
  return g;
}

export function hasDormant(genome: Genome): boolean {
  return LOCI.some((l) => genome[l].some((a) => a.dormant));
}
