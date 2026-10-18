import { deriveStats } from '../../core/character';
import { memberById } from '../../core/meta/growth';
import { useGame } from '../../store/gameStore';

/** Result panel: a won fight (back to the map) or the end of the run (settle). */
export function RunOverlay() {
  const { run, game, leaveBattle, settleRun } = useGame();
  if (!run || !game) return null;
  const roomWon = run.phase === 'explore';
  const title = roomWon
    ? '战斗胜利'
    : run.outcome === 'clear'
      ? '地下城通关！'
      : run.outcome === 'retreat'
        ? '撤退'
        : run.outcome === 'defeat'
          ? '族长重伤 · 血遁秘术'
          : '结算中…';
  const lines = roomWon ? run.floorLog.slice(-1) : run.floorLog;
  const revived = roomWon ? run.events.filter((e) => e.startsWith('【血契唤醒】')).slice(-2) : [];
  return (
    <div className="overlay">
      <div className="panel col" style={{ minWidth: 360 }}>
        <h2 className={run.outcome === 'defeat' ? 'bad' : ''}>{title}</h2>
        {[...lines, ...revived].map((l, i) => (
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
          {roomWon && (
            <button className="primary" onClick={leaveBattle}>
              返回地图
            </button>
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
