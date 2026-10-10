import { MEMORIES } from '../config/memories';
import { resolveEvent, resolveTraitChoice } from '../core/meta/actions';
import { EVENT_MAP } from '../core/meta/events';
import { memberById } from '../core/meta/growth';
import { useGame } from '../store/gameStore';
import { Modal, TraitTag } from './common';

export function Modals() {
  const { game, report, dismissReport, act, screen, toTitle, newGame } = useGame();
  if (!game || screen !== 'hub') return null;

  if (report) {
    return (
      <Modal onClose={dismissReport}>
        <h2>{report.title}</h2>
        <div className="lines">
          {report.lines.map((l, i) => (
            <div key={i} className={/叛逃|告密|陨落|衰亡|警告|战败/.test(l) ? 'bad' : /觉醒|获得|领悟|传承|牌照|出生|成年/.test(l) ? 'good' : ''}>
              {l}
            </div>
          ))}
        </div>
        <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
          <button className="primary" onClick={dismissReport}>
            知道了
          </button>
        </div>
      </Modal>
    );
  }

  if (game.gameOver) {
    return (
      <Modal>
        <h2 className="bad">真祖陨落</h2>
        <p>{game.gameOver}</p>
        <p className="dim">
          存活 {game.month - 1} 个月 · 夺舍 {game.soul.stats.possessions} 次 · 出征 {game.soul.stats.battles} 次 · 击败首领{' '}
          {game.soul.stats.bossKills} 次
        </p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button onClick={toTitle}>返回标题</button>
          <button className="primary" onClick={() => newGame()}>
            重新开始
          </button>
        </div>
      </Modal>
    );
  }

  if (game.pendingEvent) {
    const ev = game.pendingEvent;
    const def = EVENT_MAP[ev.eventId];
    return (
      <Modal>
        <h2>事件 · {def.title}</h2>
        <p style={{ lineHeight: 1.7 }}>{def.text(game, ev)}</p>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {def.options.map((o, i) => (
            <button key={i} className={i === 0 ? 'primary' : ''} onClick={() => act((g) => resolveEvent(g, i))}>
              {o.label}
            </button>
          ))}
        </div>
      </Modal>
    );
  }

  const tc = game.pendingTraitChoices[0];
  if (tc) {
    const c = memberById(game, tc.charId);
    if (c) {
      const nt = MEMORIES[tc.traitId];
      return (
        <Modal>
          <h2>特性位已满 · {c.name}</h2>
          <p>
            {c.name} 获得了新的后天特性 <TraitTag id={tc.traitId} />（{nt.desc}），但子嗣最多只能持有 4 个特性。
          </p>
          <p className="dim">选择一个被替换的特性，或放弃新特性。被放弃的特性不会再次获得。</p>
          <div className="col">
            {c.traits.map((t) => (
              <div className="row" key={t}>
                <TraitTag id={t} />
                <span className="dim grow">{MEMORIES[t].desc}</span>
                <button onClick={() => act((g) => resolveTraitChoice(g, t))}>替换它</button>
              </div>
            ))}
          </div>
          <div className="row" style={{ marginTop: 12, justifyContent: 'flex-end' }}>
            <button onClick={() => act((g) => resolveTraitChoice(g, null))}>放弃新特性</button>
          </div>
        </Modal>
      );
    }
  }
  return null;
}
