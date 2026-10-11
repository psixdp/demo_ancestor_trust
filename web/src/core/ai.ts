import { ENEMY_MOD, INTENT_BASE, INTENT_NAMES, PERSONALITY_MOD, STANCE_MOD } from '../config/balance';
import { SKILLS } from '../config/skills';
import type { Rng } from './rng';
import {
  armorBreakOf,
  bossPresent,
  canTarget,
  effectiveEva,
  effectiveMov,
  estimateDamage,
  inCross,
  knockbackOf,
  manhattan,
  opponents,
  patriarchOf,
  reachable,
  simulatePush,
  skillReady,
  tileThreat,
} from './battle/rules';
import type { BattleState, Candidate, FactorBreakdown, Intent, ScoredCandidate, Unit } from './types';

interface TileInfo {
  x: number;
  y: number;
  path: [number, number][];
  threat: number;
  distPat: number;
  nearestEnemy: number;
  adjEnemies: number;
  guard: number;
  inCross: boolean;
}

function nearestDist(x: number, y: number, units: Unit[]): number {
  let best = 99;
  for (const u of units) best = Math.min(best, manhattan(x, y, u.x, u.y));
  return best;
}

/** How well a tile shields the patriarch: adjacent, or on the shortest route between patriarch and nearest threat. */
function guardValue(x: number, y: number, pat: Unit | undefined, foes: Unit[]): number {
  if (!pat) return 0;
  const dp = manhattan(x, y, pat.x, pat.y);
  if (dp === 0 || dp > 2) return 0;
  let between = false;
  let nearest: Unit | undefined;
  let nd = 99;
  for (const f of foes) {
    const d = manhattan(f.x, f.y, pat.x, pat.y);
    if (d < nd) {
      nd = d;
      nearest = f;
    }
  }
  if (nearest) {
    between = dp + manhattan(x, y, nearest.x, nearest.y) === nd;
  }
  if (between) return 1.2;
  return dp === 1 ? 1.0 : 0;
}

function personalityMod(u: Unit, intent: Intent, inAoeNow: boolean): number {
  if (u.side === 'enemy') return ENEMY_MOD[u.aiType]?.[intent] ?? 1;
  const p = u.personality ?? 'docile';
  let m = PERSONALITY_MOD[p][intent] ?? 1;
  if (p === 'paranoid' && intent === 'retreat' && (u.hp < u.maxHp * 0.5 || inAoeNow)) m = 3.0;
  return m;
}

function stanceMod(s: BattleState, u: Unit, intent: Intent): number {
  if (u.side === 'enemy') return 1;
  const base = STANCE_MOD[s.stance][intent] ?? 1;
  return u.personality === 'docile' ? Math.pow(base, 1.5) : base;
}

export interface Decision {
  chosen: ScoredCandidate;
  top: ScoredCandidate[];
  /** best score per reachable tile, keyed "x,y" */
  heat: Record<string, number>;
}

export function decide(s: BattleState, u: Unit, rng: Rng): Decision {
  const foes = opponents(s, u);
  const pat = patriarchOf(s);
  const isAlly = u.side === 'ally';
  const hpPct = u.hp / u.maxHp;
  const patHpPct = pat ? pat.hp / pat.maxHp : 1;
  const patThreat = pat ? tileThreat(s, 'ally', pat.x, pat.y) : 0;
  const threatNow = tileThreat(s, u.side, u.x, u.y, u.id);
  const nowCross = isAlly && inCross(s, u.x, u.y);
  const distPatNow = pat ? manhattan(u.x, u.y, pat.x, pat.y) : 0;
  const nearestNow = nearestDist(u.x, u.y, foes);
  const mov = effectiveMov(u);
  const reach = reachable(s, u, mov);

  const tiles: TileInfo[] = [];
  for (const path of reach.values()) {
    const [x, y] = path[path.length - 1];
    tiles.push({
      x,
      y,
      path,
      threat: tileThreat(s, u.side, x, y, u.id),
      distPat: pat ? manhattan(x, y, pat.x, pat.y) : 0,
      nearestEnemy: nearestDist(x, y, foes),
      adjEnemies: foes.filter((f) => manhattan(f.x, f.y, x, y) === 1).length,
      guard: isAlly && u.kind !== 'patriarch' ? guardValue(x, y, pat, foes) : 0,
      inCross: isAlly && inCross(s, x, y),
    });
  }

  const usable = u.skills.filter((sk) => skillReady(u, sk.id) && (!SKILLS[sk.id].utility || SKILLS[sk.id].taunt));
  const bossHere = bossPresent(s);

  const results: ScoredCandidate[] = [];
  let anyAttack = false;

  const evaluate = (cand: Candidate, t: TileInfo, target: Unit | null): ScoredCandidate => {
    const intents: { intent: Intent; suit: number; extra: number }[] = [];
    const sk = cand.skillId ? SKILLS[cand.skillId] : null;

    if (sk?.taunt && target && pat && isAlly) {
      const nearPat = manhattan(target.x, target.y, pat.x, pat.y) <= 3 ? 1 : 0.4;
      const suit = Math.max(0.1, patThreat) * (1.5 - patHpPct) * nearPat;
      intents.push({ intent: 'guard', suit, extra: u.order?.kind === 'hold' ? 1.5 : 1 });
    }

    if (sk && target && !sk.taunt) {
      const est = estimateDamage(s, u, target, sk.mult, t.x, t.y);
      const hit = 1 - effectiveEva(target);
      const exp = est.raw * hit;
      const kill = exp >= target.hp;
      let atkSuit = Math.min(1.2, Math.max(0.15, (exp / target.hp) * 1.5));
      if (kill) atkSuit *= 1.5;
      if (target.breached) atkSuit *= 1.3;
      let extra = 1;
      if (u.aiType === 'hunter' && target.kind === 'patriarch') extra *= 1.3;
      if (u.aiType === 'boss' && target.kind === 'patriarch') extra *= 1.2;
      if (u.aiType === 'beast') extra *= 1.5 - target.hp / target.maxHp;
      if (u.order?.kind === 'focus' && u.order.targetId === target.id) extra *= 2.0;
      if (u.tauntedBy === target.id) extra *= 2.0;
      intents.push({ intent: 'attack', suit: atkSuit, extra });

      const brk = armorBreakOf(u, sk);
      let brkSuit = Math.min(1, brk / Math.max(1, target.arm));
      if (!target.breached && brk >= target.arm) brkSuit = 1.5;
      const kb = knockbackOf(u, sk);
      if (kb) {
        const push = simulatePush(s, t.x, t.y, target, kb, u.id);
        if (push.collide && !target.breached) brkSuit = Math.max(1, brkSuit) * 1.8;
      }
      if (isAlly && pat && manhattan(target.x, target.y, pat.x, pat.y) <= 2) brkSuit *= 1.3;
      if (sk.delay) brkSuit *= 1.2;
      if (target.breached) brkSuit *= 0.3;
      let bExtra = 1;
      if (u.order?.kind === 'focus' && u.order.targetId === target.id) bExtra *= 2.0;
      if (u.tauntedBy === target.id) bExtra *= 2.0;
      intents.push({ intent: 'break', suit: brkSuit, extra: bExtra });
    }

    if (isAlly && u.kind !== 'patriarch' && t.guard > 0) {
      const suit = Math.max(0.05, patThreat) * (1.5 - patHpPct) * t.guard;
      const extra = u.order?.kind === 'hold' ? 1.5 : 1;
      intents.push({ intent: 'guard', suit, extra });
    }

    if (isAlly) {
      const improve = Math.max(0, threatNow - t.threat);
      let suit = (1 - hpPct) ** 2 * 2 * improve;
      if (nowCross && !t.inCross && !u.passives.includes('faceJudgement')) suit += 0.8;
      let extra = 1;
      if (u.passives.includes('bossFear') && bossHere) extra *= 1.5;
      if (u.passives.includes('jumpy') && u.shaken) extra *= 2.0;
      if (suit > 0) intents.push({ intent: 'retreat', suit, extra });

      if (pat && u.kind !== 'patriarch' && distPatNow > 3) {
        const suit2 = Math.min(1.5, Math.max(0, (distPatNow - t.distPat) / 3));
        if (suit2 > 0) intents.push({ intent: 'regroup', suit: suit2, extra: 1 });
      }
    }

    if (foes.length > 0) {
      const adv = Math.min(1, Math.max(0, (nearestNow - t.nearestEnemy) / Math.max(1, mov)));
      if (adv > 0) intents.push({ intent: 'advance', suit: adv, extra: 1 });
    }

    if (cand.action === 'defend') {
      intents.push({ intent: 'defend', suit: anyAttack ? t.threat * 0.3 : t.threat, extra: 1 });
    }

    const factors: FactorBreakdown[] = intents.map(({ intent, suit, extra }) => {
      const base = INTENT_BASE[intent];
      const pm = personalityMod(u, intent, nowCross);
      const st = stanceMod(s, u, intent);
      let psy = 1;
      if (isAlly && u.kind === 'child') {
        if (intent === 'guard') psy *= 0.5 + u.devotion / 100;
        const risky = intent === 'guard' || t.adjEnemies >= 2;
        if (u.suspicion >= 60 && risky) psy *= Math.max(0.1, 1 - (u.suspicion - 60) / 50);
      }
      const score = base * suit * pm * st * psy * extra;
      return { intent, base, suit, personality: pm, stance: st, psyche: psy, extra, score };
    });

    factors.sort((a, b) => b.score - a.score);
    const main = factors[0];
    const rest = factors.slice(1).reduce((acc, f) => acc + f.score, 0);
    const raw = main ? main.score + 0.3 * rest : 0.01;
    const score = raw * (1 + rng.range(-0.02, 0.02));

    const moveTxt = t.x === u.x && t.y === u.y ? '原地' : `移至(${t.x},${t.y})`;
    const actTxt =
      cand.action === 'defend' ? '防御' : sk?.target === 'nova' ? `${sk.name}（相邻全体）` : sk && target ? `${sk.name}→${target.name}` : '待机';
    return {
      cand,
      score,
      mainIntent: main ? main.intent : 'advance',
      factors,
      label: `${moveTxt} ${actTxt}`,
    };
  };

  // attack candidates first so `anyAttack` is known for defend scoring
  for (const t of tiles) {
    for (const st of usable) {
      const sk = SKILLS[st.id];
      for (const f of foes) {
        if (!canTarget(s, u, t.x, t.y, f, sk)) continue;
        if (!sk.taunt) anyAttack = true;
        results.push(
          evaluate({ x: t.x, y: t.y, path: t.path, action: 'skill', skillId: sk.id, targetId: f.id, dir: null }, t, f),
        );
      }
    }
  }
  for (const t of tiles) {
    results.push(evaluate({ x: t.x, y: t.y, path: t.path, action: 'wait', skillId: null, targetId: null, dir: null }, t, null));
    results.push(evaluate({ x: t.x, y: t.y, path: t.path, action: 'defend', skillId: null, targetId: null, dir: null }, t, null));
  }

  results.sort((a, b) => b.score - a.score);
  const heat: Record<string, number> = {};
  for (const r of results) {
    const k = `${r.cand.x},${r.cand.y}`;
    if (heat[k] === undefined || r.score > heat[k]) heat[k] = r.score;
  }
  return { chosen: results[0], top: results.slice(0, 5), heat };
}

export function intentName(i: Intent): string {
  return INTENT_NAMES[i];
}
