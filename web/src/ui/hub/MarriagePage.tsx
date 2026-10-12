import { useState } from 'react';
import { LOCUS_NAMES } from '../../config/alleles';
import { BAL, PARTNER_SOURCES } from '../../config/balance';
import { isAdult } from '../../core/character';
import { previewOffspring } from '../../core/genetics';
import { breedWith } from '../../core/meta/actions';
import { LOCI, type PartnerSource } from '../../core/types';
import { useGame } from '../../store/gameStore';
import { GenomeTable, PhenoTags, pct } from '../common';

const SOURCES: PartnerSource[] = ['labor', 'dwarf', 'elf'];

export function MarriagePage() {
  const { game, act } = useGame();
  const [famId, setFamId] = useState<string | null>(null);
  const [source, setSource] = useState<PartnerSource>('labor');
  const [partnerId, setPartnerId] = useState<string | null>(null);
  if (!game) return null;

  const eligible = game.members.filter((m) => isAdult(m));
  const fam = game.members.find((m) => m.id === famId) ?? null;
  const partners = game.market[source];
  const partner = partners.find((p) => p.id === partnerId) ?? null;
  const locked = PARTNER_SOURCES[source].tier === 'B' && game.tier !== 'B';
  const preview = fam && partner ? previewOffspring(fam.genome, partner.genome) : null;
  const busy = (id: string) => game.pregnancies.some((p) => p.familyId === id);

  return (
    <div className="col">
      <h2>联姻育种</h2>
      <div className="dim">市场将在 {game.market.refreshIn} 个月后刷新。孕期 {BAL.pregnancyMonths} 个月，孕育后家族方冷却 {BAL.breedCooldown} 个月。</div>
      <div className="panel col">
        <h4>① 选择家族方</h4>
        <div className="row">
          {eligible.map((m) => {
            const dis = m.breedCooldown > 0 || busy(m.id);
            return (
              <button key={m.id} className={famId === m.id ? 'active' : ''} disabled={dis} onClick={() => setFamId(m.id)}>
                {m.isPatriarch ? '👑' : ''}
                {m.name}
                {m.breedCooldown > 0 ? `（冷却 ${m.breedCooldown}）` : busy(m.id) ? '（孕育中）' : ''}
              </button>
            );
          })}
        </div>
        {fam && <GenomeTable genome={fam.genome} />}
      </div>

      <div className="panel col">
        <h4>② 选择联姻方</h4>
        <div className="row">
          {SOURCES.map((s) => (
            <button
              key={s}
              className={source === s ? 'active' : ''}
              onClick={() => {
                setSource(s);
                setPartnerId(null);
              }}
            >
              {PARTNER_SOURCES[s].name}（{PARTNER_SOURCES[s].fee} 金）
              {PARTNER_SOURCES[s].tier === 'B' && game.tier !== 'B' ? ' 🔒B' : ''}
            </button>
          ))}
        </div>
        {PARTNER_SOURCES[source].perk && (
          <div className="dim">
            首次联姻解锁家族红利：{PARTNER_SOURCES[source].perk}
            {(source === 'dwarf' && game.perks.debtCollateral) || (source === 'elf' && game.perks.workMonitor) ? '（已解锁）' : ''}
          </div>
        )}
        {locked ? (
          <div className="warn">需要家族阶层 B（击败地下城首领获得牌照后晋升）</div>
        ) : partners.length === 0 ? (
          <div className="dim">本期候选已签完，等待市场刷新。</div>
        ) : (
          <div className="grid3">
            {partners.map((p) => (
              <div key={p.id} className={`card ${partnerId === p.id ? 'selected' : ''}`} onClick={() => setPartnerId(p.id)} style={{ cursor: 'pointer' }}>
                <div className="row">
                  <b>{p.name}</b>
                  <span className="grow" />
                  <span className="gold">{p.fee} 金</span>
                </div>
                <PhenoTags genome={p.genome} />
                <GenomeTable genome={p.genome} />
              </div>
            ))}
          </div>
        )}
      </div>

      {preview && fam && partner && (
        <div className="panel col">
          <h4>③ 子代表型概率预览</h4>
          <table>
            <tbody>
              {LOCI.map((l) => (
                <tr key={l}>
                  <td className="dim" style={{ width: 90 }}>
                    {LOCUS_NAMES[l]}
                  </td>
                  <td>
                    {preview[l].map((o, i) => (
                      <span key={i} className="prob">
                        <span className={o.dormantNote ? 'warn' : ''}>{o.label}</span>
                        {o.dormantNote ? '（携带休眠）' : ''} <span className="gold">{pct(o.prob)}</span>
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="dim" style={{ fontSize: 12 }}>
            “携带休眠”表示子代将带有出生即休眠的异族等位基因，需要在基因诱变室激活后才会表达。
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              className="primary"
              disabled={game.gold < partner.fee}
              onClick={() => {
                const r = act((g) => breedWith(g, fam.id, source, partner.id));
                if (r?.ok) {
                  setPartnerId(null);
                  setFamId(null);
                }
              }}
            >
              签订联姻合同（{partner.fee} 金）
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
