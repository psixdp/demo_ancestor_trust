import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MutableRefObject } from 'react';
import { PERSONALITY_NAMES } from '../../config/alleles';
import { STANCE_NAMES } from '../../config/balance';
import { ENEMIES } from '../../config/enemies';
import { PASSIVE_SOURCE_NAMES, passiveInfo } from '../../config/passives';
import { SKILLS } from '../../config/skills';
import {
  endTurn,
  executeTargets,
  isPlayerTurn,
  playerDefend,
  playerEndTurn,
  playerExecute,
  playerMove,
  playerMoveTargets,
  playerSkill,
  playerUndoMove,
  runAiTurn,
  setStance,
  skillTargets,
  timeline,
  type TargetOption,
} from '../../core/battle/engine';
import { DIRS, getUnit, key } from '../../core/battle/rules';
import type { BattleFx, BattleState, Stance, Unit } from '../../core/types';
import { useGame } from '../../store/gameStore';
import { AiPanel } from './AiPanel';
import { ExploreView } from './ExploreView';
import { RunOverlay } from './RunOverlay';

type Mode = { kind: 'move' } | { kind: 'skill'; id: string } | { kind: 'exec' };
const FACING = ['▲', '▶', '▼', '◀'];

function shortName(u: Unit): string {
  if (u.kind === 'enemy') return ENEMIES[u.enemyType ?? '']?.short ?? u.name.slice(0, 1);
  return u.name.replace('族长·', '').slice(0, 3);
}

/** Tile width plus grid gap, in px; must match `.tile` and `.board` in styles.css. */
const CELL = 76;
const STEP_MS = 130;
const FLOAT_MS = 2300;

const TRAIL_COLOR = { patriarch: '#5aa0ff', ally: '#3fc060', enemy: '#e04848' };

interface Floating extends BattleFx {
  born: number;
  /** fx ids restart every floor, so floats need their own key */
  uid: number;
  /** waits for earlier moves in the same batch, so hits land after the attacker arrives */
  delay: number;
  dur: number;
}

let floatSeq = 0;

function pathSteps(path: [number, number][]): number {
  let n = 0;
  for (let i = 1; i < path.length; i++) n += Math.abs(path[i][0] - path[i - 1][0]) + Math.abs(path[i][1] - path[i - 1][1]);
  return n;
}

const floatAlive = (p: Floating, now: number) => now - p.born < p.delay + p.dur + FLOAT_MS;

/**
 * Keeps freshly emitted fx around long enough for their animation. Moves in one batch play in sequence.
 * Runs as a layout effect so a moved token never paints at its destination before its slide starts.
 */
function useFloatingFx(s: BattleState | null): { items: Floating[]; busyUntil: MutableRefObject<number> } {
  const [items, setItems] = useState<Floating[]>([]);
  const seen = useRef(s?.fxSeq ?? 0);
  const busyUntil = useRef(0);
  useLayoutEffect(() => {
    if (!s) return;
    if (s.fxSeq < seen.current) seen.current = 0;
    const fresh = s.fx.filter((f) => f.id > seen.current);
    seen.current = s.fxSeq;
    if (fresh.length === 0) return;
    const now = Date.now();
    let t = 0;
    const added = fresh.map((f): Floating => {
      const delay = t;
      const dur = f.kind === 'move' && f.path ? pathSteps(f.path) * STEP_MS : 0;
      t += dur;
      return { ...f, born: now, uid: ++floatSeq, delay, dur };
    });
    busyUntil.current = now + t;
    setItems((prev) => [...prev.filter((p) => floatAlive(p, now)), ...added]);
    const timer = setTimeout(() => setItems((prev) => prev.filter((p) => floatAlive(p, Date.now()))), t + FLOAT_MS + 100);
    return () => clearTimeout(timer);
  }, [s, s?.fxSeq]);
  return { items, busyUntil };
}

export function BattleView() {
  const { run, battle, debug, aiDelay } = useGame();
  const b = run?.battle ?? null;
  const [mode, setMode] = useState<Mode>({ kind: 'move' });
  const [selected, setSelected] = useState<string | null>(null);
  const [hoverDir, setHoverDir] = useState<number | null>(null);
  const { items: floats, busyUntil } = useFloatingFx(b);
  const logRef = useRef<HTMLDivElement>(null);

  const playerTurn = !!b && isPlayerTurn(b) && run?.phase === 'battle';
  const active = b ? getUnit(b, b.activeId) : undefined;

  useEffect(() => {
    if (!b || b.result || run?.phase !== 'battle' || playerTurn || debug.stepMode) return;
    const wait = aiDelay + Math.max(0, busyUntil.current - Date.now());
    const t = setTimeout(() => battle((s) => runAiTurn(s)), wait);
    return () => clearTimeout(t);
  }, [b, run?.phase, playerTurn, debug.stepMode, aiDelay, battle, busyUntil]);

  useEffect(() => {
    setMode({ kind: 'move' });
  }, [b?.activeId, b?.turn.acted]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [b?.log.length]);

  const moveTargets = useMemo(() => (b && playerTurn && mode.kind === 'move' ? playerMoveTargets(b) : new Map()), [b, playerTurn, mode]);
  const options: TargetOption[] = useMemo(() => {
    if (!b || !playerTurn) return [];
    if (mode.kind === 'skill') return skillTargets(b, mode.id);
    if (mode.kind === 'exec') return executeTargets(b);
    return [];
  }, [b, playerTurn, mode]);
  const execOptions = useMemo(() => (b && playerTurn ? executeTargets(b) : []), [b, playerTurn]);

  if (!run) return null;
  if (!b) return <ExploreView />;

  const cross = new Set<string>();
  for (const u of b.units) if (u.boss?.crossTiles && !u.downed) for (const [x, y] of u.boss.crossTiles) cross.add(key(x, y));
  const markTargets = new Set(b.units.filter((u) => u.boss?.markTarget && !u.downed).map((u) => u.boss!.markTarget!));
  const lastDecision = b.decisions[b.decisions.length - 1];
  const heat = debug.enabled && debug.heatmap && lastDecision ? lastDecision.heat : null;
  const heatMax = heat ? Math.max(0.0001, ...Object.values(heat)) : 1;
  const sweepHighlight = new Set<string>();
  if (mode.kind === 'skill' && SKILLS[mode.id].target === 'sweep' && hoverDir !== null)
    for (const o of options) if (o.dir === hoverDir) sweepHighlight.add(key(o.x, o.y));

  const onTile = (x: number, y: number) => {
    const u = b.units.find((t) => !t.downed && t.x === x && t.y === y);
    if (!playerTurn || !active) {
      if (u) setSelected(u.id);
      return;
    }
    if (mode.kind === 'move') {
      if (moveTargets.has(key(x, y)) && !(x === active.x && y === active.y)) battle((s) => playerMove(s, x, y));
      else if (u) setSelected(u.id);
      return;
    }
    const at = options.filter((o) => o.x === x && o.y === y);
    if (at.length === 0) {
      setMode({ kind: 'move' });
      if (u) setSelected(u.id);
      return;
    }
    let opt = at[0];
    if (mode.kind === 'skill' && SKILLS[mode.id].target === 'sweep') {
      opt = at.find((o) => o.dir !== undefined && active.x + DIRS[o.dir][0] === x && active.y + DIRS[o.dir][1] === y) ?? at[0];
    }
    if (mode.kind === 'exec') {
      battle((s) => {
        if (playerExecute(s, opt.targetId!) && !s.result) playerEndTurn(s);
      });
    } else {
      const id = mode.id;
      battle((s) => {
        const ok = playerSkill(s, id, { targetId: opt.targetId, dir: opt.dir, x: opt.x, y: opt.y });
        if (ok && SKILLS[id].target !== 'blink' && !s.result) playerEndTurn(s);
      });
    }
    setMode({ kind: 'move' });
  };

  const onSkillButton = (id: string) => {
    const sk = SKILLS[id];
    if (sk.target === 'self') {
      battle((s) => {
        if (playerSkill(s, id, {}) && !s.result) playerEndTurn(s);
      });
      return;
    }
    setMode(mode.kind === 'skill' && mode.id === id ? { kind: 'move' } : { kind: 'skill', id });
  };

  const tl = timeline(b, 10);
  const sel = getUnit(b, selected) ?? active;

  return (
    <div className="battle">
      <div className="battle-left">
        <div className="row" style={{ width: '100%', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0 }}>
            第 {b.floor} 层{b.isBossFloor ? ' · 首领战' : ''}
            {b.difficulty === 2 ? ' · 难度 II' : ''}
          </h3>
          <span className="dim">
            本次战利品：{run.gold} 金 · {run.mutagen} 原液 · {run.xp} 历练
          </span>
        </div>
        <div className="timeline">
          <span className="dim" style={{ fontSize: 12 }}>
            行动轴
          </span>
          {tl.map((u, i) => (
            <div key={i} className={`tl ${u.side} ${u.kind === 'patriarch' ? 'patriarch' : ''} ${i === 0 ? 'now' : ''}`} title={u.name}>
              {shortName(u)}
            </div>
          ))}
        </div>
        <div style={{ position: 'relative' }}>
          <div className="board" style={{ gridTemplateColumns: `repeat(${b.w}, 74px)` }}>
            {Array.from({ length: b.w * b.h }, (_, i) => {
              const x = i % b.w;
              const y = Math.floor(i / b.w);
              const k = key(x, y);
              const u = b.units.find((t) => !t.downed && t.x === x && t.y === y);
              const blocked = b.blocked[i];
              const isOpt = options.some((o) => o.x === x && o.y === y);
              let cls = 'tile';
              if ((x + y) % 2) cls += ' dark';
              if (blocked) cls += ' block';
              else if (mode.kind === 'move' && moveTargets.has(k) && !(active && active.x === x && active.y === y)) cls += ' move';
              else if (isOpt) cls += mode.kind === 'exec' ? ' exec' : ' target';
              if (sweepHighlight.has(k)) cls += ' exec';
              if (cross.has(k)) cls += ' cross';
              const h = heat?.[k];
              const optDir = isOpt && mode.kind === 'skill' && SKILLS[mode.id].target === 'sweep' && active
                ? options.find((o) => o.x === x && o.y === y && o.dir !== undefined && active.x + DIRS[o.dir][0] === x && active.y + DIRS[o.dir][1] === y)?.dir
                : undefined;
              return (
                <div
                  key={k}
                  className={cls}
                  onClick={() => onTile(x, y)}
                  onMouseEnter={() => setHoverDir(optDir ?? null)}
                  onMouseLeave={() => setHoverDir(null)}
                >
                  <span className="coord">
                    {x},{y}
                  </span>
                  {h !== undefined && (
                    <div className="heat" style={{ background: `rgba(255,170,40,${(h / heatMax) * 0.55})` }}>
                      {h.toFixed(2)}
                    </div>
                  )}
                  {u && (
                    <UnitToken
                      u={u}
                      active={u.id === b.activeId}
                      marked={markTargets.has(u.id)}
                      move={floats.filter((f) => f.kind === 'move' && f.unitId === u.id).pop()}
                    />
                  )}
                  {u &&
                    floats
                      .filter((f) => f.unitId === u.id && f.kind !== 'move')
                      .map((f) => (
                        <div
                          key={f.uid}
                          className={f.kind === 'bubble' ? 'bubble' : `dmgnum ${f.kind}`}
                          style={f.delay ? { animationDelay: `${f.delay}ms`, animationFillMode: 'both' } : undefined}
                        >
                          {f.text}
                        </div>
                      ))}
                </div>
              );
            })}
            <MoveTrails floats={floats} units={b.units} />
          </div>
          {(run.phase !== 'battle' || b.result) && <RunOverlay />}
        </div>

        <div className="row">
          <span className="dim">态势：</span>
          {(['guard', 'assault', 'self'] as Stance[]).map((st) => (
            <button key={st} className={b.stance === st ? 'active' : ''} onClick={() => battle((s) => setStance(s, st))}>
              {STANCE_NAMES[st]}
            </button>
          ))}
        </div>
        {playerTurn && active ? (
          <div className="actionbar">
            {active.skills.map((st) => {
              const sk = SKILLS[st.id];
              const cd = Math.max(0, st.readyAt - active.turnCount);
              const n = cd === 0 && !b.turn.acted ? skillTargets(b, st.id).length : 0;
              return (
                <button
                  key={st.id}
                  className={mode.kind === 'skill' && mode.id === st.id ? 'active' : ''}
                  disabled={cd > 0 || b.turn.acted || n === 0}
                  title={sk.desc}
                  onClick={() => onSkillButton(st.id)}
                >
                  {sk.name}
                  {cd > 0 ? `（${cd}）` : ''}
                </button>
              );
            })}
            <button
              className={execOptions.length > 0 ? 'primary' : ''}
              disabled={execOptions.length === 0}
              onClick={() => setMode(mode.kind === 'exec' ? { kind: 'move' } : { kind: 'exec' })}
              title="对相邻的破绽目标：伤害 ×2.5、无视防御、必中；击杀返还 50% 行动消耗"
            >
              处决{execOptions.length > 0 ? `（${execOptions.length}）` : ''}
            </button>
            <button onClick={() => battle(playerDefend)} disabled={b.turn.acted}>
              防御
            </button>
            <button onClick={() => battle(playerEndTurn)}>{b.turn.moved ? '结束回合' : '待机'}</button>
            <button onClick={() => battle(playerUndoMove)} disabled={!b.turn.moved || b.turn.acted}>
              撤销移动
            </button>
          </div>
        ) : (
          <div className="row">
            <span className="dim">{b.result ? '战斗结束' : `${active?.name ?? ''} 行动中…`}</span>
            {debug.stepMode && !b.result && !playerTurn && (
              <button className="primary" onClick={() => battle((s) => runAiTurn(s))}>
                下一步 ▶
              </button>
            )}
          </div>
        )}
        {sel && <UnitInfo u={sel} s={b} />}
      </div>

      <div className="battle-right">
        <div className="panel">
          <h4>战斗日志</h4>
          <div className="log" ref={logRef}>
            {b.log.map((l, i) => (
              <div key={i} className={l.startsWith('·') ? 'ai' : ''}>
                {l}
              </div>
            ))}
          </div>
        </div>
        {debug.enabled && debug.aiPanel && <AiPanel s={b} />}
        {debug.enabled && sel && <BattleCheats u={sel} />}
      </div>
    </div>
  );
}

function trailColor(u: Unit | undefined): string {
  if (!u) return TRAIL_COLOR.enemy;
  return u.kind === 'patriarch' ? TRAIL_COLOR.patriarch : u.side === 'ally' ? TRAIL_COLOR.ally : TRAIL_COLOR.enemy;
}

/** Fading path lines drawn over the board while units slide along them. */
function MoveTrails({ floats, units }: { floats: Floating[]; units: Unit[] }) {
  const moves = floats.filter((f) => f.kind === 'move' && f.path);
  if (moves.length === 0) return null;
  const center = (v: number) => 2 + v * CELL + (CELL - 2) / 2;
  return (
    <svg className="move-trails">
      {moves.map((f) => {
        const path = f.path!;
        const len = pathSteps(path) * CELL;
        const color = trailColor(units.find((u) => u.id === f.unitId));
        const [sx, sy] = path[0];
        const fade = `trail-fade 600ms ease-in ${f.delay + f.dur + 900}ms forwards`;
        return (
          <g key={f.uid} stroke={color} fill={color}>
            <circle cx={center(sx)} cy={center(sy)} r={5} stroke="none" style={{ animation: fade }} />
            <polyline
              points={path.map(([x, y]) => `${center(x)},${center(y)}`).join(' ')}
              fill="none"
              strokeWidth={4}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray={len}
              style={{
                strokeDashoffset: len,
                animation: `trail-draw ${f.dur}ms linear ${f.delay}ms forwards, ${fade}`,
              }}
            />
          </g>
        );
      })}
    </svg>
  );
}

function UnitToken({ u, active, marked, move }: { u: Unit; active: boolean; marked: boolean; move?: Floating }) {
  const cls = u.kind === 'patriarch' ? 'patriarch' : u.side === 'ally' ? 'ally' : u.isBoss ? 'enemy boss' : 'enemy';
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const path = move?.path;
    if (!el || !move || !path || move.dur <= 0) return;
    const remaining = move.born + move.delay + move.dur - Date.now();
    if (remaining <= 0) return;
    const [ex, ey] = path[path.length - 1];
    const total = pathSteps(path);
    let walked = 0;
    const frames = path.map(([x, y], i) => {
      if (i > 0) walked += Math.abs(x - path[i - 1][0]) + Math.abs(y - path[i - 1][1]);
      return { transform: `translate(${(x - ex) * CELL}px, ${(y - ey) * CELL}px)`, offset: walked / total };
    });
    el.style.zIndex = '4';
    const anim = el.animate(frames, {
      duration: move.dur,
      delay: move.born + move.delay - Date.now(),
      fill: 'backwards',
      easing: 'ease-in-out',
    });
    anim.onfinish = () => (el.style.zIndex = '');
    return () => {
      anim.cancel();
      el.style.zIndex = '';
    };
  }, [move?.uid]);
  return (
    <div ref={ref} className={`unit ${cls} ${active ? 'active' : ''} ${u.breached ? 'breached' : ''}`}>
      <span className="facing" style={{ top: 2, left: 4 }}>
        {FACING[u.facing]}
      </span>
      {u.breached && <span className="flag">破绽</span>}
      {!u.breached && u.defending && <span className="flag">守</span>}
      {marked && (
        <span className="flag bad" style={{ top: 12 }}>
          ⚠处刑
        </span>
      )}
      <span className="nm">{shortName(u)}</span>
      <span style={{ fontSize: 10 }} className="dim">
        {u.hp}/{u.maxHp}
      </span>
      <div className="bars">
        <div className="hpb">
          <div style={{ width: `${(u.hp / u.maxHp) * 100}%`, background: u.side === 'enemy' ? '#d0505a' : undefined }} />
        </div>
        <div className="armb">
          <div style={{ width: `${(u.arm / Math.max(1, u.maxArm)) * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

function UnitInfo({ u, s }: { u: Unit; s: BattleState }) {
  return (
    <div className="panel unit-info" style={{ width: '100%', maxWidth: 640 }}>
      <div className="row">
        <b className="gold">{u.name}</b>
        {u.personality && <span className="tag">{PERSONALITY_NAMES[u.personality]}</span>}
        {u.kind === 'child' && (
          <span className="dim">
            狂信 {u.devotion} · 疑心 {u.suspicion}
          </span>
        )}
        <span className="dim">朝向 {FACING[u.facing]}</span>
      </div>
      <div className="dim">
        HP {u.hp}/{u.maxHp} · ATK {u.atk} · DEF {u.def}
        {u.breached ? '（破绽减半）' : ''} · ARM {u.arm}/{u.maxArm} · SPD {u.spd} · MOV {u.mov} · EVA {Math.round(u.eva * 100)}% · 下次行动{' '}
        {Math.round(u.nextActAt)}
      </div>
      <div className="row" style={{ gap: 2 }}>
        {u.skills.map((st) => (
          <span key={st.id} className="tag skill" title={SKILLS[st.id].desc}>
            {SKILLS[st.id].name}
            {st.readyAt > u.turnCount ? `（${st.readyAt - u.turnCount}）` : ''}
          </span>
        ))}
        {u.passives.map((p) => {
          const info = passiveInfo(p, u.kind === 'patriarch');
          const cls = info.source === 'gene' ? 'gene' : info.source === 'job' ? 'job' : info.shadow ? 'shadow' : 'trait';
          return (
            <span key={p} className={`tag ${cls}`} title={info.desc}>
              <span className="src">{PASSIVE_SOURCE_NAMES[info.source]}</span>
              {info.name}
            </span>
          );
        })}
        {u.spotted && <span className="tag warn">被观测</span>}
        {u.tauntedBy && <span className="tag warn">被挑衅：{getUnit(s, u.tauntedBy)?.name}</span>}
        {u.order && <span className="tag">号令：{u.order.kind === 'focus' ? `集火 ${getUnit(s, u.order.targetId)?.name}` : '死守'}</span>}
        {u.boss && (
          <span className="tag warn">
            首领循环 {u.boss.step % 5}/5{u.boss.crossTiles ? ' · 十字蓄力中' : ''}
            {u.boss.markTarget ? ' · 处刑宣告' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

function BattleCheats({ u }: { u: Unit }) {
  const battle = useGame((s) => s.battle);
  const mut = (fn: (t: Unit, s: BattleState) => void) =>
    battle((s) => {
      const t = getUnit(s, u.id);
      if (t) fn(t, s);
    });
  return (
    <div className="panel col">
      <h4>战斗作弊 · {u.name}</h4>
      <div className="row">
        <button
          className="small"
          onClick={() =>
            mut((t, s) => {
              t.hp = 0;
              t.downed = true;
              if (t.side === 'enemy' && t.enemyType) s.killsByType[t.enemyType] = (s.killsByType[t.enemyType] ?? 0) + 1;
              if (!s.units.some((x) => x.side === 'enemy' && !x.downed)) s.result = 'victory';
              if (t.kind === 'patriarch') s.result = 'defeat';
              if (!s.result && s.activeId === t.id) endTurn(s);
            })
          }
        >
          秒杀
        </button>
        <button className="small" onClick={() => mut((t) => void (t.hp = t.maxHp))}>
          满血
        </button>
        <button className="small" onClick={() => mut((t) => void ((t.arm = 0), (t.breached = true)))}>
          设为破绽
        </button>
        <button className="small" onClick={() => mut((t) => void (t.arm = t.maxArm))}>
          满护甲
        </button>
        <button
          className="small"
          onClick={() =>
            mut((t, s) => {
              const min = Math.min(...s.units.filter((x) => !x.downed && x.id !== s.activeId).map((x) => x.nextActAt));
              t.nextActAt = min - 1;
            })
          }
        >
          插队到下一个
        </button>
      </div>
    </div>
  );
}
