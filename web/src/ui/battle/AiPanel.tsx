import { useState } from 'react';
import { INTENT_NAMES } from '../../config/balance';
import type { BattleState } from '../../core/types';

export function AiPanel({ s }: { s: BattleState }) {
  const [seq, setSeq] = useState<number | null>(null);
  const list = s.decisions;
  const d = (seq !== null ? list.find((x) => x.seq === seq) : undefined) ?? list[list.length - 1];
  return (
    <div className="panel aipanel">
      <div className="row">
        <h4 className="grow" style={{ margin: 0 }}>
          AI 打分面板
        </h4>
        <select value={seq ?? ''} onChange={(e) => setSeq(e.target.value ? Number(e.target.value) : null)}>
          <option value="">跟随最新</option>
          {[...list].reverse().map((x) => (
            <option key={x.seq} value={x.seq}>
              #{x.seq} {x.unitName}
            </option>
          ))}
        </select>
      </div>
      {!d ? (
        <div className="dim">尚无 AI 决策</div>
      ) : d.slacked ? (
        <div className="warn">
          #{d.seq} {d.unitName}：疑心 ≥ 80，本回合消极怠工
        </div>
      ) : (
        <>
          <div className="dim">
            #{d.seq} {d.unitName}（起点 {d.from[0]},{d.from[1]}）
          </div>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>候选</th>
                <th>总分</th>
                <th>意图分解：基础×适宜×性格×态势×心理×额外</th>
              </tr>
            </thead>
            <tbody>
              {d.top.map((c, i) => (
                <tr key={i} style={i === 0 ? { color: 'var(--gold)' } : undefined}>
                  <td>{i + 1}</td>
                  <td>{c.label}</td>
                  <td>{c.score.toFixed(3)}</td>
                  <td>
                    {c.factors.map((f, j) => (
                      <div key={j} className={j === 0 ? '' : 'dim'}>
                        {INTENT_NAMES[f.intent]} {f.base.toFixed(2)}×{f.suit.toFixed(2)}×{f.personality.toFixed(2)}×{f.stance.toFixed(2)}×
                        {f.psyche.toFixed(2)}×{f.extra.toFixed(2)} = {f.score.toFixed(3)}
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="dim" style={{ fontSize: 11 }}>
            总分 = 主意图得分 + 0.3 × 其他意图得分之和（±2% 噪声）
          </div>
        </>
      )}
    </div>
  );
}
