import { deriveStats } from '../../core/character';
import { memberById } from '../../core/meta/growth';
import { useGame } from '../../store/gameStore';

export function RunOverlay() {
  const { run, game, continueRun, retreatRun, settleRun } = useGame();
  if (!run || !game) return null;
  const title =
    run.phase === 'between'
      ? `第 ${run.floor} 层 胜利`
      : run.outcome === 'clear'
        ? '地下城通关！'
        : run.outcome === 'retreat'
          ? '撤退'
          : run.outcome === 'defeat'
            ? '族长重伤 · 血遁秘术'
            : '结算中…';
  return (
    <div className="overlay">
      <div className="panel col" style={{ minWidth: 360 }}>
        <h2 className={run.outcome === 'defeat' ? 'bad' : ''}>{title}</h2>
        {run.floorLog.map((l, i) => (
          <div key={i} style={{ fontSize: 13 }}>
            {l}
          </div>
        ))}
        <div className="dim">
          累计：{run.gold} 金 · {run.mutagen} 原液 · {run.xp} 历练点
          {run.outcome === 'defeat' ? '（金币与原液将损失 50%）' : ''}
        </div>
        <div className="col" style={{ gap: 2 }}>
          {run.team.map((id) => {
            const c = memberById(game, id);
            if (!c) return null;
            const max = deriveStats(c, game.soul).hp;
            const down = run.downed.includes(id);
            return (
              <div key={id} style={{ fontSize: 13 }}>
                {c.isPatriarch ? '👑' : ''}
                {c.name}：{down ? <span className="bad">倒地</span> : `${run.hp[id]}/${max}`}
              </div>
            );
          })}
        </div>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {run.phase === 'between' && (
            <>
              <button onClick={retreatRun}>撤退（保留全部战利品）</button>
              <button className="primary" onClick={continueRun}>
                继续前往第 {run.floor + 1} 层{run.floor + 1 === 4 ? '（首领）' : ''}
              </button>
            </>
          )}
          {run.phase === 'done' && (
            <button className="primary" onClick={settleRun}>
              返回主城并结算本月
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
