import { PERSONALITY_NAMES } from '../../config/alleles';
import { INTENT_NAMES } from '../../config/balance';
import { exportGame } from '../../core/meta/save';
import type { Analytics, Intent, Personality } from '../../core/types';
import { useGame } from '../../store/gameStore';

function download(name: string, text: string, type = 'application/json') {
  const blob = new Blob([text], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function analyticsCsv(a: Analytics): string {
  const rows: string[][] = [['metric', 'key', 'value']];
  for (const [k, v] of Object.entries(a)) {
    if (typeof v === 'number') rows.push(['total', k, String(v)]);
  }
  for (const [p, m] of Object.entries(a.intentCounts)) for (const [i, n] of Object.entries(m)) rows.push(['intent', `${p}:${i}`, String(n)]);
  a.possessions.forEach((p, i) =>
    rows.push(['possession', String(i + 1), `month=${p.month};sync=${p.containerSync};slots=${p.slots};traits=${p.traits}`]),
  );
  return rows.map((r) => r.join(',')).join('\n');
}

export function ReportsPage() {
  const game = useGame((s) => s.game);
  if (!game) return null;
  const a = game.analytics;
  const intents: Intent[] = ['attack', 'break', 'guard', 'retreat', 'regroup', 'defend', 'advance'];

  return (
    <div className="col">
      <div className="row">
        <h2 className="grow">月报与数据</h2>
        <button onClick={() => download(`ancestor-trust-m${game.month}.json`, exportGame(game))}>导出存档 JSON</button>
        <button onClick={() => download(`analytics-m${game.month}.csv`, analyticsCsv(a), 'text/csv')}>导出埋点 CSV</button>
      </div>
      <div className="panel col">
        <h4>验证数据（本局累计）</h4>
        <div className="row" style={{ fontSize: 13 }}>
          <span>战斗 {a.battles}</span>
          <span>AI 制造破绽 {a.aiBreaches}</span>
          <span>处决 AI 破绽 {a.executionsOnAiBreach}</span>
          <span>反应拦截 {a.intercepts}</span>
          <span>态势切换 {a.stanceSwitches}</span>
          <span>战败 {a.defeats}</span>
          <span>夺舍 {a.possessions.length}</span>
          <span>配种 {a.breedings}</span>
          <span>心理支出 {a.psycheSpending}</span>
          <span>告密 {a.informants}</span>
          <span>叛逃 {a.defections}</span>
          <span>应激觉醒/阴影 {a.stressAwaken}/{a.stressShadow}</span>
          <span>失去的特性 {a.lostTraits}</span>
        </div>
        <table style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>性格</th>
              {intents.map((i) => (
                <th key={i}>{INTENT_NAMES[i]}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(a.intentCounts).map(([p, m]) => {
              const total = Object.values(m).reduce((s, v) => s + v, 0) || 1;
              return (
                <tr key={p}>
                  <td>{PERSONALITY_NAMES[p as Personality] ?? p}</td>
                  {intents.map((i) => (
                    <td key={i}>{m[i] ? `${Math.round((m[i] / total) * 100)}%` : '—'}</td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {game.reports.map((r, i) => (
        <div className="panel" key={i}>
          <h4>第 {r.month} 月</h4>
          {r.lines.map((l, j) => (
            <div key={j} style={{ fontSize: 13, padding: '1px 0' }}>
              {l}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
