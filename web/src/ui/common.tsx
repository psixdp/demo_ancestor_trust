import type { ReactNode } from 'react';
import { ALLELE_MAP, LOCUS_NAMES, PERSONALITY_NAMES } from '../config/alleles';
import { TRAUMAS } from '../config/balance';
import { MEMORIES } from '../config/memories';
import { SKILLS } from '../config/skills';
import { express } from '../core/genetics';
import { LOCI, type Genome, type TraumaId } from '../core/types';

export function Meter({
  label,
  value,
  max = 100,
  color,
  marks = [],
}: {
  label: string;
  value: number;
  max?: number;
  color: string;
  marks?: number[];
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="meter">
      <span className="lbl">{label}</span>
      <div className="bar">
        <div className="fill" style={{ width: `${pct}%`, background: color }} />
        {marks.map((m) => (
          <div key={m} className="mark" style={{ left: `${(m / max) * 100}%` }} />
        ))}
      </div>
      <span className="val">{Math.round(value)}</span>
    </div>
  );
}

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

export function TraitTag({ id, kind }: { id: string; kind?: 'trait' | 'shadow' }) {
  const m = MEMORIES[id];
  if (!m) return <span className="tag">{id}</span>;
  const cls = kind ?? (m.source === 'shadow' ? 'shadow' : 'trait');
  const catTxt = m.category === 'combat' ? '战斗' : m.category === 'business' ? '经营' : '心理';
  return (
    <span className={`tag ${cls} ${m.category === 'psyche' ? 'psyche' : ''}`} title={`[${catTxt}] ${m.desc}`}>
      {m.name}
    </span>
  );
}

export function TraumaTag({ id }: { id: TraumaId }) {
  return (
    <span className="tag trauma" title={TRAUMAS[id].desc}>
      {TRAUMAS[id].name}
    </span>
  );
}

export function SkillTag({ id }: { id: string }) {
  const s = SKILLS[id];
  return (
    <span className="tag skill" title={s?.desc}>
      {s?.name ?? id}
    </span>
  );
}

export function PhenoTags({ genome }: { genome: Genome }) {
  const p = express(genome);
  const names = LOCI.flatMap((l) => p.expressed[l].map((id) => ALLELE_MAP[id].name));
  return (
    <span>
      {names.map((n, i) => (
        <span className="tag" key={i}>
          {n}
        </span>
      ))}
    </span>
  );
}

export function GenomeTable({ genome }: { genome: Genome }) {
  const p = express(genome);
  return (
    <table className="genome">
      <tbody>
        {LOCI.map((l) => (
          <tr key={l}>
            <td className="dim">{LOCUS_NAMES[l]}</td>
            {genome[l].map((a, i) => {
              const def = ALLELE_MAP[a.id];
              const on = p.expressed[l].includes(a.id) && !a.dormant;
              const cls = a.dormant ? 'dormant' : on ? 'on' : 'off';
              return (
                <td key={i}>
                  <span className={`allele ${cls}`} title={`显性等级 ${def.rank}${def.source !== 'common' ? ` · ${def.source === 'dwarf' ? '矮人' : '精灵'}` : ''}`}>
                    {def.name}
                    {a.dormant ? '（休眠）' : ''}
                    {def.source !== 'common' ? ' ◆' : ''}
                  </span>
                </td>
              );
            })}
            <td className="gold">→ {p.expressed[l].map((id) => ALLELE_MAP[id].name).join('+')}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function personalityName(genome: Genome) {
  return PERSONALITY_NAMES[express(genome).personality];
}

export function pct(v: number) {
  return `${Math.round(v * 100)}%`;
}
