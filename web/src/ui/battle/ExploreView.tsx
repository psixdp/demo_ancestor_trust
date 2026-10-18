import { ENEMIES } from '../../config/enemies';
import { BAL } from '../../config/balance';
import { deriveStats, hasPassive } from '../../core/character';
import { canMoveTo, canTakeStairs } from '../../core/meta/expedition';
import { LAST_FLOOR, MAP_H, MAP_W, ROOM_NAMES, linked, type Room } from '../../core/meta/floorMap';
import { memberById, patriarch } from '../../core/meta/growth';
import { useGame } from '../../store/gameStore';
import { RunOverlay } from './RunOverlay';

const ROOM_ICON: Record<Room['kind'], string> = {
  entry: '⇡',
  empty: '·',
  guard: '⚔',
  side: '🎁',
  rest: '🩸',
  stairs: '▼',
  boss: '☠',
};

function enemyList(types: string[]): string {
  const n: Record<string, number> = {};
  for (const t of types) n[t] = (n[t] ?? 0) + 1;
  return Object.entries(n)
    .map(([t, k]) => `${ENEMIES[t]?.name ?? t}${k > 1 ? `×${k}` : ''}`)
    .join('、');
}

export function ExploreView() {
  const { run, game, moveTo, useRest, useBloodBag, takeStairs, retreatRun } = useGame();
  if (!run || !game) return null;
  const map = run.map;
  const here = map.rooms.find((r) => r.id === run.roomId)!;
  const pat = patriarch(game);
  const patrol = map.patrol;
  const exploring = run.phase === 'explore';

  const cells = [];
  for (let gy = 0; gy < MAP_H * 2 - 1; gy++) {
    for (let gx = 0; gx < MAP_W * 2 - 1; gx++) {
      const k = `${gx},${gy}`;
      if (gx % 2 === 0 && gy % 2 === 0) {
        const id = (gy / 2) * MAP_W + gx / 2;
        const room = map.rooms.find((r) => r.id === id);
        if (!room || !room.seen) {
          cells.push(<div key={k} className="room void" />);
          continue;
        }
        const reachable = exploring && canMoveTo(run, id);
        const patrolHere = patrol?.roomId === id;
        let cls = `room kind-${room.kind}`;
        if (id === run.roomId) cls += ' here';
        if (reachable) cls += ' reachable';
        if (!room.visited) cls += ' unvisited';
        if (room.enemies) cls += ' hostile';
        cells.push(
          <div key={k} className={cls} data-kind={room.kind} data-visited={room.visited} onClick={() => reachable && moveTo(id)}>
            <div className="room-icon">{ROOM_ICON[room.kind]}</div>
            <div className="room-name">{ROOM_NAMES[room.kind]}</div>
            {room.enemies && <div className="room-sub bad">{enemyList(room.enemies)}</div>}
            {!room.enemies && (room.kind === 'guard' || room.kind === 'boss') && <div className="room-sub dim">已击破</div>}
            {room.kind === 'side' && !room.enemies && <div className="room-sub dim">宝箱已开</div>}
            {room.kind === 'rest' && <div className="room-sub dim">{room.used ? '已饮尽' : '可休整一次'}</div>}
            {patrolHere && <div className="room-sub warn">巡逻：{enemyList(patrol!.enemies)}</div>}
            {id === run.roomId && <div className="room-team">👑 队伍</div>}
          </div>,
        );
      } else if (gx % 2 !== gy % 2) {
        const a = gx % 2 === 1 ? (gy / 2) * MAP_W + (gx - 1) / 2 : ((gy - 1) / 2) * MAP_W + gx / 2;
        const b = gx % 2 === 1 ? a + 1 : a + MAP_W;
        const ra = map.rooms.find((r) => r.id === a);
        const rb = map.rooms.find((r) => r.id === b);
        const show = ra && rb && (ra.seen || rb.seen) && (ra.visited || rb.visited) && linked(map, a, b);
        cells.push(<div key={k} className={`door ${gx % 2 === 1 ? 'h' : 'v'} ${show ? 'open' : ''}`} />);
      } else {
        cells.push(<div key={k} />);
      }
    }
  }

  return (
    <div className="battle">
      <div className="battle-left">
        <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>
            旧城区地下血库遗址 · 第 {run.floor} 层{run.floor >= LAST_FLOOR ? ' · 首领层' : ''}
            {run.difficulty === 2 ? ' · 难度 II' : ''}
          </h3>
          <span className="dim">
            本次战利品：{run.gold} 金 · {run.mutagen} 原液 · {run.xp} 历练
          </span>
        </div>
        <div className="dim" style={{ fontSize: 12 }}>
          点击相邻房间前进。守卫房是下楼的必经之路；支路敌群守着宝箱，可以绕开。巡逻队每走 {BAL.patrolEvery} 步移动一次，撞上它会被伏击（敌方先动）。
        </div>
        <div style={{ position: 'relative' }}>
          <div className="dungeon">{cells}</div>
          {run.phase === 'done' && <RunOverlay />}
        </div>
      </div>
      <div className="battle-right">
        <div className="panel col">
          <h4>队伍</h4>
          {run.team.map((id) => {
            const c = memberById(game, id)!;
            const max = deriveStats(c, game.soul).hp;
            const down = run.downed.includes(id);
            const hp = run.hp[id];
            return (
              <div key={id} className="row" style={{ fontSize: 13 }}>
                <span style={{ minWidth: 90 }}>
                  {c.isPatriarch ? '👑' : ''}
                  {c.name}
                </span>
                {down ? (
                  <span className="bad">倒地</span>
                ) : (
                  <span className={hp < max * 0.5 ? 'warn' : ''}>
                    {hp}/{max}
                  </span>
                )}
                <span className="grow" />
                <button
                  className="small"
                  disabled={!exploring || run.bloodBags <= 0 || down || hp >= max}
                  onClick={() => useBloodBag(id)}
                  title={`回复 ${Math.round(BAL.bloodBagHeal * 100)}% 最大生命，不能救起倒地者`}
                >
                  血袋
                </button>
              </div>
            );
          })}
          <div className="dim" style={{ fontSize: 12 }}>
            血袋 {run.bloodBags} 袋 ·
            {hasPassive(pat, game.soul, 'bloodPact') ? ' 血契唤醒：胜利后倒地者以 30% 生命归队' : ' 倒地者本次出征不再归队（记忆「血契唤醒」可扶起）'}
            {hasPassive(pat, game.soul, 'nightAmbush') ? ' · 夜行先机：进入敌房我方先动' : ''}
          </div>
        </div>
        <div className="panel col">
          <h4>当前：{ROOM_NAMES[here.kind]}</h4>
          <div className="row">
            {here.kind === 'rest' && (
              <button className="primary" disabled={!exploring || here.used} onClick={useRest}>
                饮下血库残罐（全员 +{Math.round(BAL.restHeal * 100)}%）
              </button>
            )}
            {canTakeStairs(run) && (
              <button className="primary" onClick={takeStairs}>
                下楼前往第 {run.floor + 1} 层{run.floor + 1 >= LAST_FLOOR ? '（首领）' : ''}（回复 {Math.round(BAL.floorHeal * 100)}%）
              </button>
            )}
            <button disabled={!exploring} onClick={retreatRun}>
              撤退（保留全部战利品）
            </button>
          </div>
        </div>
        <div className="panel col log" style={{ fontSize: 12 }}>
          <h4>见闻</h4>
          {run.events.map((e, i) => (
            <div key={i}>{e}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
