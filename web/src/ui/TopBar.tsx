import { BAL } from '../config/balance';
import { monthsToAging, monthsToDeath } from '../core/character';
import { patriarch } from '../core/meta/growth';
import { useGame } from '../store/gameStore';

export function TopBar() {
  const { game, toTitle, saveSlot, screen } = useGame();
  if (!game) return null;
  const pat = patriarch(game);
  const toAging = pat ? monthsToAging(pat) : 0;
  const toDeath = pat ? monthsToDeath(pat) : 0;
  const aging = toAging <= 0;
  return (
    <div className="topbar">
      <span className="brand">血月投资集团</span>
      <span className="stat">
        第 <b>{game.month}</b> 月
      </span>
      <span className="stat">
        金币 <b>{game.gold}</b>
      </span>
      <span className="stat">
        诱变原液 <b>{game.mutagen}</b>
      </span>
      <span className="stat">
        历练点 <b>{game.soul.soulXP}</b>
      </span>
      <span className="stat">
        阶层 <b>{game.tier}</b>
        {game.license && game.tier === 'C' ? <span className="good">（持牌）</span> : null}
      </span>
      {pat && (
        <span className={`stat ${aging ? 'alarm' : ''}`}>
          族长 {pat.name}：{pat.ageMonths} 月 ·{' '}
          {aging ? `衰老中，${toDeath} 月后衰亡，请尽快安排继任仪式` : `距衰老 ${toAging} 月`} · 创伤 {pat.traumas.length}/
          {BAL.maxTraumas}
        </span>
      )}
      <span className="grow" />
      <span className="dim" style={{ fontSize: 12 }}>
        种子 {game.seed}
      </span>
      {screen === 'hub' && (
        <>
          <button className="small" onClick={() => saveSlot('1')}>
            存档1
          </button>
          <button className="small" onClick={() => saveSlot('2')}>
            存档2
          </button>
          <button className="small" onClick={() => saveSlot('3')}>
            存档3
          </button>
          <button className="small" onClick={toTitle}>
            标题
          </button>
        </>
      )}
    </div>
  );
}
