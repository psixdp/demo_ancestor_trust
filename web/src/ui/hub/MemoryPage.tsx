import { BAL } from '../../config/balance';
import { ENEMIES } from '../../config/enemies';
import { MEMORY_LIST, type MemoryDef } from '../../config/memories';
import { loadPreset, savePreset, setEquipped, unlockMemory } from '../../core/meta/actions';
import { patriarch } from '../../core/meta/growth';
import { useGame } from '../../store/gameStore';

const GROUPS: { name: string; filter: (m: MemoryDef) => boolean; how: string }[] = [
  { name: '武器战技 / 战术号令', filter: (m) => m.source === 'xp' && m.kind === 'active', how: '历练点解锁' },
  { name: '被动', filter: (m) => m.source === 'xp' && m.kind === 'passive', how: '历练点解锁' },
  { name: '绝境被动', filter: (m) => m.source === 'desperation', how: '族长战败时满足条件觉醒' },
  {
    name: '经历特性 / 传承记忆',
    filter: (m) => (m.source === 'experience' || m.source === 'awaken') && m.category !== 'psyche',
    how: '族长自身经历达标，或夺舍时吸收容器的后天特性',
  },
];

export function MemoryPage() {
  const { game, act } = useGame();
  if (!game) return null;
  const pat = patriarch(game);
  const soul = game.soul;
  const slots = pat.activeSlots;

  const toggle = (id: string) => {
    const eq = soul.equipped.includes(id) ? soul.equipped.filter((x) => x !== id) : [...soul.equipped, id];
    act((g) => setEquipped(g, eq));
  };

  return (
    <div className="col">
      <h2>先祖记忆池</h2>
      <div className="panel col">
        <div className="row">
          <span>
            当前肉体 <b className="gold">{pat.name}</b> · 记忆槽 {soul.equipped.length}/{slots}
          </span>
          <span className="dim">战斗类与经营类记忆共用记忆槽；主城内可随时免费调整。</span>
        </div>
        <div className="row">
          {Array.from({ length: slots }, (_, i) => {
            const id = soul.equipped[i];
            const m = MEMORY_LIST.find((x) => x.id === id);
            return (
              <div key={i} className="card" style={{ minWidth: 130, padding: '6px 10px' }}>
                {m ? (
                  <>
                    <span className="gold">{m.name}</span>
                    <span className="dim" style={{ fontSize: 11 }}>
                      {m.category === 'business' ? '经营' : m.kind === 'active' ? '主动' : '被动'}
                    </span>
                  </>
                ) : (
                  <span className="dim">空槽</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="row">
          <span className="dim">预设：</span>
          <button className="small" onClick={() => act((g) => loadPreset(g, 'battle'))}>
            载入出征配置（{soul.presets.battle.length}）
          </button>
          <button className="small" onClick={() => act((g) => loadPreset(g, 'work'))}>
            载入上岗配置（{soul.presets.work.length}）
          </button>
          <button className="small" onClick={() => act((g) => savePreset(g, 'battle'))}>
            保存为出征配置
          </button>
          <button className="small" onClick={() => act((g) => savePreset(g, 'work'))}>
            保存为上岗配置
          </button>
        </div>
      </div>

      {GROUPS.map((grp) => (
        <div className="panel col" key={grp.name}>
          <h4>
            {grp.name} <span className="dim" style={{ fontSize: 12 }}>· {grp.how}</span>
          </h4>
          <table>
            <tbody>
              {MEMORY_LIST.filter(grp.filter).map((m) => {
                const owned = soul.pool.includes(m.id);
                const eq = soul.equipped.includes(m.id);
                const canBuy = m.source === 'xp' && !owned && soul.soulXP >= (m.cost ?? 0);
                return (
                  <tr key={m.id}>
                    <td style={{ width: 120 }} className={owned ? 'gold' : 'dim'}>
                      {m.name}
                    </td>
                    <td style={{ width: 60 }} className="dim">
                      {m.category === 'business' ? '经营' : m.kind === 'active' ? '主动' : '被动'}
                    </td>
                    <td className={owned ? '' : 'dim'}>{m.desc}</td>
                    <td style={{ width: 150, textAlign: 'right' }}>
                      {owned ? (
                        <button className={`small ${eq ? 'active' : ''}`} disabled={!eq && soul.equipped.length >= slots} onClick={() => toggle(m.id)}>
                          {eq ? '已装配' : '装配'}
                        </button>
                      ) : m.source === 'xp' ? (
                        <button className="small" disabled={!canBuy} onClick={() => act((g) => unlockMemory(g, m.id))}>
                          解锁（{m.cost} 历练）
                        </button>
                      ) : (
                        <span className="dim">未获得</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <div className="panel col">
        <h4>
          敌情解析 <span className="dim" style={{ fontSize: 12 }}>· 同类敌人累计击杀 {BAL.intelThreshold} 次自动解锁，常驻生效不占槽，伤害 +15%</span>
        </h4>
        <div className="row">
          {Object.values(ENEMIES).map((e) => {
            const n = soul.intel[e.id] ?? 0;
            return (
              <span key={e.id} className={`tag ${n >= BAL.intelThreshold ? 'trait' : ''}`}>
                {e.name} {Math.min(n, BAL.intelThreshold)}/{BAL.intelThreshold}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
