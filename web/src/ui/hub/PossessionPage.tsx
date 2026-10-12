import { useState } from 'react';
import { BAL } from '../../config/balance';
import { MEMORIES } from '../../config/memories';
import { deriveStats, monthsToDeath } from '../../core/character';
import { possessionCandidates } from '../../core/meta/actions';
import { patriarch } from '../../core/meta/growth';
import type { Character, GameState } from '../../core/types';
import { useGame } from '../../store/gameStore';
import { ClassTag, SkillTag, TraitTag, TraumaTag } from '../common';

function asPatriarchStats(c: Character, g: GameState, syncMul: number) {
  const tmp: Character = { ...c, isPatriarch: true, syncMul, baseTemplate: undefined };
  return deriveStats(tmp, g.soul);
}

export function PossessionPage() {
  const { game, possess } = useGame();
  const [sel, setSel] = useState<string | null>(null);
  const [equip, setEquip] = useState<string[]>([]);
  if (!game) return null;
  const pat = patriarch(game);
  const cands = possessionCandidates(game);
  const patStats = deriveStats(pat, game.soul);
  const chosen = cands.find((x) => x.c.id === sel);

  const pick = (id: string) => {
    setSel(id);
    const c = cands.find((x) => x.c.id === id)!;
    const absorbed = c.c.traits.filter((t) => MEMORIES[t].category !== 'psyche');
    const pool = [...new Set([...game.soul.equipped, ...absorbed])];
    setEquip(pool.slice(0, c.active));
  };
  const toggle = (id: string) => {
    if (!chosen) return;
    if (equip.includes(id)) setEquip(equip.filter((x) => x !== id));
    else if (equip.length < chosen.active) setEquip([...equip, id]);
  };
  const futurePool = chosen ? [...new Set([...game.soul.pool, ...chosen.c.traits.filter((t) => MEMORIES[t].category !== 'psyche')])] : [];

  return (
    <div className="col">
      <h2>夺舍仪式</h2>
      <div className="panel dim">
        当前肉体：<span className="gold">{pat.name}</span>（{pat.ageMonths} 月，{monthsToDeath(pat)} 月后衰亡）· HP {patStats.hp} ATK {patStats.atk} · 激活槽{' '}
        {pat.activeSlots} · 创伤 {pat.traumas.length}
        <br />
        容器条件：成年子嗣、同步率 ≥ {BAL.possessionMinSync}。费用 {BAL.possessionCost} 金（葬礼与公关费），消耗当月时间。夺舍后全族疑心 +
        {BAL.possessionSuspicion}。
        <br />
        仪式等级：<span className="gold">初阶·密室暴毙传位</span> · <span style={{ opacity: 0.4 }}>中阶·全息双簧（未研发）</span> ·{' '}
        <span style={{ opacity: 0.4 }}>高阶·数字血脉（未研发）</span>
      </div>
      {cands.length === 0 ? (
        <div className="panel warn">没有成年子嗣可作为容器。</div>
      ) : (
        <div className="panel">
          <table>
            <thead>
              <tr>
                <th>候选</th>
                <th>夺舍后属性</th>
                <th>职业与技能</th>
                <th>同步率</th>
                <th>记忆槽</th>
                <th>剩余寿命</th>
                <th>创伤</th>
                <th>将被吸收</th>
                <th>将被抹除</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {cands.map(({ c, sync, slots, active, syncMul }) => {
                const st = asPatriarchStats(c, game, syncMul);
                const absorb = c.traits.filter((t) => MEMORIES[t].category !== 'psyche');
                const erase = [...c.traits.filter((t) => MEMORIES[t].category === 'psyche'), ...c.shadows];
                const ok = sync >= BAL.possessionMinSync;
                return (
                  <tr key={c.id} style={sel === c.id ? { background: '#2a1f18' } : undefined}>
                    <td>
                      <b>{c.name}</b>
                      <div className="dim" style={{ fontSize: 11 }}>
                        {c.ageMonths} 月
                      </div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      HP {st.hp} ATK {st.atk} DEF {st.def}
                      <br />
                      SPD {st.spd} MOV {st.mov} ×{syncMul.toFixed(3)}
                    </td>
                    <td>
                      <ClassTag classId={c.classId} />
                      {st.skills.map((s) => (
                        <SkillTag key={s} id={s} />
                      ))}
                    </td>
                    <td className={ok ? (sync >= 60 ? 'good' : 'warn') : 'bad'}>
                      {sync}%
                      <div className="dim" style={{ fontSize: 11 }}>
                        狂信 {c.devotion} / 疑心 {c.suspicion}
                      </div>
                    </td>
                    <td>
                      {active}/{slots}
                    </td>
                    <td>{monthsToDeath(c)} 月</td>
                    <td>
                      {c.traumas.map((t, i) => (
                        <TraumaTag key={i} id={t} />
                      ))}
                    </td>
                    <td>
                      {absorb.map((t) => (
                        <TraitTag key={t} id={t} />
                      ))}
                    </td>
                    <td>
                      {erase.map((t) => (
                        <span key={t} style={{ opacity: 0.6 }}>
                          <TraitTag id={t} kind={c.shadows.includes(t) ? 'shadow' : 'trait'} />
                        </span>
                      ))}
                    </td>
                    <td>
                      <button className={`small ${sel === c.id ? 'active' : ''}`} disabled={!ok} onClick={() => pick(c.id)}>
                        选为容器
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {chosen && (
        <div className="panel col">
          <h4>
            记忆装配：{equip.length}/{chosen.active}
          </h4>
          <div className="row">
            {futurePool.map((id) => (
              <button
                key={id}
                className={`small ${equip.includes(id) ? 'active' : ''}`}
                disabled={!equip.includes(id) && equip.length >= chosen.active}
                title={MEMORIES[id].desc}
                onClick={() => toggle(id)}
              >
                {MEMORIES[id].name}
                {!game.soul.pool.includes(id) ? '（新）' : ''}
              </button>
            ))}
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button
              className="primary"
              disabled={game.gold < BAL.possessionCost}
              onClick={() => {
                if (!confirm(`确定夺舍 ${chosen.c.name}？${pat.name} 的肉体将被抛弃，${chosen.c.name} 的意识将被抹除。`)) return;
                possess(chosen.c.id, equip);
                setSel(null);
              }}
            >
              执行继任仪式（{BAL.possessionCost} 金）
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
