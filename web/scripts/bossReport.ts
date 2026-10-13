// Boss floor diagnostics: `npx vite-node scripts/bossReport.ts [seeds]`
// Patriarch is AI-played. Reports where boss fights are lost.
import { ENCOUNTERS, ENEMIES } from '../src/config/enemies';
import { createBattle, runAiTurn } from '../src/core/battle/engine';
import { changeClass } from '../src/core/meta/actions';
import { continueRun, finishBattle, startRun } from '../src/core/meta/expedition';
import { createNewGame } from '../src/core/meta/newGame';
import { BAL } from '../src/config/balance';
import { unitFromCharacter } from '../src/core/meta/units';
import type { GameState } from '../src/core/types';

const seeds = Number(process.argv[2] ?? 200);

function report(name: string, setup: (g: GameState) => void = () => {}, hpPct = 1, team = ['c1', 'c2', 'c3']) {
  let wins = 0;
  let turns = 0;
  let bossBreaches = 0;
  let bossExecs = 0;
  let bossHpEnd = 0;
  let addsLeft = 0;
  let firstDownChild = 0;
  const patDmg: Record<string, number> = {};
  const patDeath: Record<string, number> = {};
  for (let seed = 1; seed <= seeds; seed++) {
    const g = createNewGame(seed);
    setup(g);
    const allies = team.map((id) => {
      const u = unitFromCharacter(g.members.find((m) => m.id === id)!, g.soul);
      u.hp = Math.round(u.maxHp * hpPct);
      return u;
    });
    const b = createBattle({ allies, floor: 4, difficulty: 1, seed: seed * 7919, stance: 'assault', intelTypes: [] });
    let guard = 0;
    while (!b.result && guard++ < 4000) runAiTurn(b, { autoPatriarch: true });
    const boss = b.units.find((u) => u.isBoss)!;
    const pat = b.units.find((u) => u.id === 'c1')!;
    turns += pat.turnCount;
    if (b.result === 'victory') wins++;
    else {
      bossHpEnd += boss.hp / boss.maxHp;
      addsLeft += b.units.filter((u) => u.side === 'enemy' && !u.isBoss && !u.downed).length;
    }

    let tag = 'normal';
    let lastHit = '';
    for (const line of b.log) {
      if (line.includes('释放【银焰十字】')) tag = 'cross';
      else if (line.includes('执行【处刑宣告】')) tag = 'mark';
      else if (line.includes(`${boss.name} 陷入破绽`)) bossBreaches++;
      const m = line.match(/^(.+?) (使用.+?|处决) → (.+?)(（背击）)?：(\d+)/);
      if (m) {
        const [, attacker, verb, target, , dmg] = m;
        if (verb === '处决' && target === boss.name) bossExecs++;
        if (target === pat.name) {
          const src = attacker === boss.name ? `首领·${tag === 'cross' ? '银焰十字' : tag === 'mark' ? '处刑宣告' : '普攻'}` : attacker.replace(/\d+$/, '');
          patDmg[src] = (patDmg[src] ?? 0) + Number(dmg);
          lastHit = src;
        }
        if (!line.includes('十字')) tag = tag === 'cross' ? 'cross' : 'normal';
      } else if (!line.startsWith('·')) tag = line.includes('释放【银焰十字】') ? 'cross' : line.includes('执行【处刑宣告】') ? 'mark' : 'normal';
      if (line.includes('倒地，退出战斗') && !firstDownChild) firstDownChild = 0;
    }
    if (b.result === 'defeat') patDeath[lastHit] = (patDeath[lastHit] ?? 0) + 1;
  }
  const losses = seeds - wins;
  const totalDmg = Object.values(patDmg).reduce((a, v) => a + v, 0) || 1;
  console.log(`\n${name}：胜率 ${Math.round((wins / seeds) * 100)}%，族长平均回合 ${(turns / seeds).toFixed(1)}`);
  console.log(`  首领平均被破绽 ${(bossBreaches / seeds).toFixed(2)} 次，被处决 ${(bossExecs / seeds).toFixed(2)} 次`);
  if (losses) console.log(`  败局：首领剩余血量 ${Math.round((bossHpEnd / losses) * 100)}%，剩余小怪 ${(addsLeft / losses).toFixed(2)}`);
  console.log(
    `  族长受到的伤害来源：${Object.entries(patDmg)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${Math.round((v / totalDmg) * 100)}%`)
      .join('，')}`,
  );
  if (losses)
    console.log(
      `  族长致死一击：${Object.entries(patDeath)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k} ${v}`)
        .join('，')}`,
    );
}

console.log(`首领：${JSON.stringify(ENEMIES.boss)}`);
console.log(`遭遇：${JSON.stringify(ENCOUNTERS[4])}，${seeds} 个种子`);
report('开局阵容 满血');
report('开局阵容 80% 血', undefined, 0.8);
report('开局阵容 只剩族长+1 子嗣 满血', undefined, 1, ['c1', 'c2']);
report('全高阶 满血', (g) => {
  changeClass(g, 'c1', 'vanguard');
  changeClass(g, 'c2', 'bulwark');
  changeClass(g, 'c3', 'shade');
});

const orig = ENCOUNTERS[4];
ENCOUNTERS[4] = [[['boss', 1, 1]]];
report('变体：首领单挑（无小怪） 满血');
ENCOUNTERS[4] = orig;

const origArm = ENEMIES.boss.arm;
ENEMIES.boss.arm = 60;
report('变体：首领 ARM 100 → 60 满血');
ENEMIES.boss.arm = origArm;

const origHp = ENEMIES.boss.hp;
ENEMIES.boss.hp = 300;
report('变体：首领 HP 400 → 300 满血');
ENEMIES.boss.hp = origHp;

/** Clear rate of a full expedition (floors 1-4) for the opening team. */
function fullClear(name: string) {
  let clears = 0;
  let reach4 = 0;
  for (let seed = 1; seed <= seeds; seed++) {
    const g = createNewGame(seed);
    const r = startRun(g, ['c2', 'c3'], 1);
    if (!r.ok) throw new Error(r.msg);
    const run = r.run;
    for (;;) {
      if (run.floor === 4) reach4++;
      const b = run.battle!;
      let guard = 0;
      while (!b.result && guard++ < 4000) runAiTurn(b, { autoPatriarch: true });
      finishBattle(g, run);
      if (run.phase === 'done') break;
      continueRun(g, run);
    }
    if (run.floorsCleared === 4) clears++;
  }
  console.log(`  ${name.padEnd(30)} 到达首领层 ${Math.round((reach4 / seeds) * 100)}%，通关 ${Math.round((clears / seeds) * 100)}%`);
}

console.log('\n完整出征（开局阵容，第 1 层打到第 4 层）');
fullClear('现状');
BAL.floorHeal = 0.4;
fullClear('层间回复 20% → 40%');
BAL.floorHeal = 0.2;
ENCOUNTERS[4] = [[['boss', 1, 1], ['apprentice', 1, 1]]];
fullClear('首领层去掉重盾兵');
BAL.floorHeal = 0.4;
fullClear('去掉重盾兵 + 层间回复 40%');
BAL.floorHeal = 0.2;
ENCOUNTERS[4] = orig;
