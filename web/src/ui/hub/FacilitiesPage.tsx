import { useState } from 'react';
import { ALLELE_MAP, LOCUS_NAMES } from '../../config/alleles';
import { BAL, FACILITIES } from '../../config/balance';
import { isAdult } from '../../core/character';
import { assignJob, orderMutation } from '../../core/meta/actions';
import { monthlyIncome } from '../../core/meta/month';
import { LOCI, type FacilityId, type LocusId } from '../../core/types';
import { useGame } from '../../store/gameStore';
import { GenomeTable } from '../common';

const FAC_IDS: FacilityId[] = ['plasma', 'mine'];

export function FacilitiesPage() {
  const { game, act } = useGame();
  const [mutChar, setMutChar] = useState<string>('');
  const [locus, setLocus] = useState<LocusId>('L1');
  const [idx, setIdx] = useState<0 | 1>(0);
  if (!game) return null;
  const fin = monthlyIncome(game);
  const adults = game.members.filter(isAdult);
  const mc = game.members.find((m) => m.id === mutChar);
  const target = mc?.genome[locus][idx];

  return (
    <div className="col">
      <h2>设施与岗位</h2>
      <div className="panel">
        预计本月：产出 <span className="good">+{fin.income}</span>，维护费 {BAL.upkeep} + 生活费 {BAL.livingCost}×{game.members.length} ={' '}
        <span className="bad">−{fin.cost}</span>，结余{' '}
        <span className={fin.income - fin.cost >= 0 ? 'good' : 'bad'}>{fin.income - fin.cost}</span>
        <div className="dim" style={{ fontSize: 12 }}>
          族长也可以上岗；经营类记忆（如【血账老手】）需要族长装配后才生效。出征会消耗当月时间并自动结算。
        </div>
      </div>
      <div className="grid2">
        {FAC_IDS.map((f) => {
          const def = FACILITIES[f];
          const staff = game.members.filter((m) => m.job === f);
          return (
            <div className="panel col" key={f}>
              <h4>
                {def.name}（{staff.length}/{def.cap}）
              </h4>
              <div className="dim">
                每人每月 +{def.output} 金 · 在岗者疑心 +{def.suspicion}/月 · {def.desc}
              </div>
              {staff.map((m) => (
                <div className="row" key={m.id}>
                  <span className="grow">
                    {m.isPatriarch ? '👑' : ''}
                    {m.name}
                  </span>
                  <button className="small" onClick={() => act((g) => assignJob(g, m.id, null))}>
                    下岗
                  </button>
                </div>
              ))}
            </div>
          );
        })}
      </div>
      <div className="panel col">
        <h4>岗位分配</h4>
        <table>
          <thead>
            <tr>
              <th>成员</th>
              <th>当前</th>
              <th>疑心</th>
              <th>分配</th>
            </tr>
          </thead>
          <tbody>
            {adults.map((m) => (
              <tr key={m.id}>
                <td>
                  {m.isPatriarch ? '👑' : ''}
                  {m.name}
                </td>
                <td>{m.job ? FACILITIES[m.job].name : <span className="dim">空闲</span>}</td>
                <td>{m.isPatriarch ? '—' : m.suspicion}</td>
                <td>
                  <select value={m.job ?? ''} onChange={(e) => act((g) => assignJob(g, m.id, (e.target.value || null) as FacilityId | null))}>
                    <option value="">空闲</option>
                    {FAC_IDS.map((f) => (
                      <option key={f} value={f}>
                        {FACILITIES[f].name}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel col">
        <h4>基因诱变室</h4>
        <div className="dim">
          激活休眠：{BAL.mutateActivate.mutagen} 原液 + {BAL.mutateActivate.gold} 金；随机突变：{BAL.mutateRandom.mutagen} 原液 +{' '}
          {BAL.mutateRandom.gold} 金。工期 1 个月，同时只能进行一个工单。诱变原液只能从地下城获得。
        </div>
        {game.mutation ? (
          <div className="warn">
            进行中：{game.members.find((m) => m.id === game.mutation!.charId)?.name} 的 {LOCUS_NAMES[game.mutation.locus]} 第{' '}
            {game.mutation.index + 1} 位（{game.mutation.kind === 'activate' ? '激活休眠' : '随机突变'}），下月完成
          </div>
        ) : (
          <>
            <div className="row">
              <select value={mutChar} onChange={(e) => setMutChar(e.target.value)}>
                <option value="">选择成员</option>
                {game.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <select value={locus} onChange={(e) => setLocus(e.target.value as LocusId)}>
                {LOCI.map((l) => (
                  <option key={l} value={l}>
                    {LOCUS_NAMES[l]}
                  </option>
                ))}
              </select>
              <select value={idx} onChange={(e) => setIdx(Number(e.target.value) as 0 | 1)}>
                <option value={0}>等位基因 1</option>
                <option value={1}>等位基因 2</option>
              </select>
              {target && (
                <span>
                  当前：{ALLELE_MAP[target.id].name}
                  {target.dormant ? <span className="warn">（休眠）</span> : ''}
                </span>
              )}
            </div>
            {mc && <GenomeTable genome={mc.genome} />}
            <div className="row">
              <button
                disabled={!mc || !target?.dormant}
                onClick={() => act((g) => orderMutation(g, { kind: 'activate', charId: mutChar, locus, index: idx }))}
              >
                激活休眠
              </button>
              <button disabled={!mc} onClick={() => act((g) => orderMutation(g, { kind: 'mutate', charId: mutChar, locus, index: idx }))}>
                随机突变
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
