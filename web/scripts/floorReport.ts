// Headless floor report: `npx vite-node scripts/floorReport.ts [floor] [seeds]`
// The patriarch is auto-played by the AI, so win rates are a lower bound for a human player.
import { ENCOUNTERS } from '../src/config/enemies';
import { createBattle, runAiTurn } from '../src/core/battle/engine';
import { changeClass } from '../src/core/meta/actions';
import { deriveStats } from '../src/core/character';
import { autoRun, startRun } from '../src/core/meta/expedition';
import { createNewGame } from '../src/core/meta/newGame';
import { unitFromCharacter } from '../src/core/meta/units';
import type { GameState } from '../src/core/types';

const floor = Number(process.argv[2] ?? 3);
const seeds = Number(process.argv[3] ?? 200);

type Setup = (g: GameState) => void;

function run(name: string, setup: Setup, hpPct = 1) {
  let wins = 0;
  let turns = 0;
  let breaches = 0;
  let execs = 0;
  let execOnAi = 0;
  let patHpLeft = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const g = createNewGame(seed);
    setup(g);
    const team = ['c1', 'c2', 'c3'];
    const allies = team.map((id) => {
      const c = g.members.find((m) => m.id === id)!;
      const u = unitFromCharacter(c, g.soul);
      u.hp = Math.round(u.maxHp * hpPct);
      return u;
    });
    const b = createBattle({ allies, floor, difficulty: 1, seed: seed * 7919, stance: 'assault', intelTypes: [] });
    let guard = 0;
    while (!b.result && guard++ < 3000) runAiTurn(b, { autoPatriarch: true });
    const pat = b.units.find((u) => u.id === 'c1')!;
    if (b.result === 'victory') {
      wins++;
      patHpLeft += pat.hp / pat.maxHp;
    }
    turns += pat.turnCount;
    breaches += b.aiBreachIds.length;
    execs += b.tally.c1.executions;
    execOnAi += b.executionsOnAiBreach;
  }
  const pct = (n: number) => `${Math.round((n / seeds) * 100)}%`;
  const avg = (n: number) => (n / seeds).toFixed(2);
  console.log(
    `${name.padEnd(28)} 胜率 ${pct(wins).padStart(4)}  族长回合 ${avg(turns)}  AI破绽 ${avg(breaches)}  处决 ${avg(execs)}（其中收割AI破绽 ${avg(execOnAi)}）  胜局族长余血 ${wins ? Math.round((patHpLeft / wins) * 100) : 0}%`,
  );
}

const opening: Setup = () => {};
const advanced: Setup = (g) => {
  changeClass(g, 'c1', 'vanguard');
  changeClass(g, 'c2', 'bulwark');
  changeClass(g, 'c3', 'shade');
};
const noLunge: Setup = (g) => {
  g.soul.equipped = g.soul.equipped.filter((id) => id !== 'bloodLunge');
};

console.log(`第 ${floor} 层，${seeds} 个种子，遭遇：${JSON.stringify(ENCOUNTERS[floor])}\n`);
run('开局阵容 满血', opening);
run('开局阵容 70% 血', opening, 0.7);
run('开局阵容 满血 不带闪现', noLunge);
run('全高阶 满血', advanced);
run('全高阶 70% 血', advanced, 0.7);

const maxHp = (g: GameState, id: string) => deriveStats(g.members.find((m) => m.id === id)!, g.soul).hp;

/** Full expedition from floor 1: how teams arrive at each floor and where they fall. */
function fullRuns(name: string, setup: Setup, bags = 0) {
  let clears = 0;
  const reached: Record<number, number> = {};
  const lost: Record<number, number> = {};
  const hpIn: Record<number, number> = {};
  const aliveIn: Record<number, number> = {};
  for (let seed = 1; seed <= seeds; seed++) {
    const g = createNewGame(seed);
    setup(g);
    const r = startRun(g, ['c2', 'c3'], 1, bags);
    if (!r.ok) throw new Error(r.msg);
    const runState = r.run;
    autoRun(g, runState, (rs) => {
      const f = rs.floor;
      const standing = rs.team.filter((id) => !rs.downed.includes(id));
      reached[f] = (reached[f] ?? 0) + 1;
      hpIn[f] = (hpIn[f] ?? 0) + standing.reduce((s, id) => s + rs.hp[id] / maxHp(g, id), 0) / standing.length;
      aliveIn[f] = (aliveIn[f] ?? 0) + standing.length;
    });
    if (runState.outcome === 'defeat') lost[runState.floor] = (lost[runState.floor] ?? 0) + 1;
    if (runState.outcome === 'clear') clears++;
  }
  console.log(`\n完整出征：${name}（通关 ${Math.round((clears / seeds) * 100)}%）`);
  for (const f of [1, 2, 3, 4]) {
    const n = reached[f] ?? 0;
    if (!n) continue;
    console.log(
      `  第 ${f} 层：到达 ${n}，失败 ${lost[f] ?? 0}（${Math.round(((lost[f] ?? 0) / n) * 100)}%），入场平均人数 ${(aliveIn[f] / n).toFixed(2)}，入场平均血量 ${Math.round((hpIn[f] / n) * 100)}%`,
    );
  }
}

const withPact: Setup = (g) => {
  g.soul.pool.push('bloodPact');
  g.soul.equipped = ['sweep', 'bloodLunge', 'bloodPact'];
};

fullRuns('开局阵容', opening);
fullRuns('开局阵容 + 3 血袋', opening, 3);
fullRuns('开局阵容 + 血契唤醒（替换穿刺突进）', withPact);
fullRuns('开局阵容 + 血契唤醒 + 3 血袋', withPact, 3);
fullRuns('全高阶', advanced);

const original = ENCOUNTERS[floor];
if (floor === 3) {
  ENCOUNTERS[3] = [[['apprentice', 1, 1], ['gunner', 1, 1], ['shield', 1, 1], ['rat', 1, 1]]];
  console.log('\n变体：第三层少一名银弹射手（4 敌）');
  run('开局阵容 满血', opening);
  run('开局阵容 70% 血', opening, 0.7);
  ENCOUNTERS[3] = [[['apprentice', 1, 1], ['gunner', 2, 2], ['rat', 1, 1]]];
  console.log('\n变体：第三层去掉重盾兵（4 敌）');
  run('开局阵容 满血', opening);
  run('开局阵容 70% 血', opening, 0.7);
  ENCOUNTERS[3] = original;
}
