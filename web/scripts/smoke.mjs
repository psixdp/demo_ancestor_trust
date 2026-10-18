// Browser smoke test: node scripts/smoke.mjs [url]  (needs `npm run dev` running)
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] ?? 'http://localhost:5173/';
const out = new URL('../shots/', import.meta.url).pathname.replace(/^\/(\w:)/, '$1');
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 960 } });
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));
page.on('dialog', (d) => d.accept());
const shot = (name) => page.screenshot({ path: `${out}${name}.png` });
const nav = (name) => page.locator('.nav button', { hasText: name }).click();

await page.goto(url);
await page.evaluate(() => localStorage.clear());
await page.reload();
await page.fill('input[placeholder^="随机种子"]', '12345');
await page.click('text=新的家族');
await page.waitForSelector('.card');
await page.evaluate(() => window.__game.getState().setAiDelay(30));
await shot('01-family');

await nav('联姻育种');
await page.locator('.panel button', { hasText: '艾德里安' }).click();
await page.locator('.grid3 .card').first().click();
await shot('02-marriage');

await nav('设施与岗位');
await shot('03-facilities');
await nav('先祖记忆池');
await shot('04-memory');
await nav('夺舍仪式');
await shot('05-possession');

await nav('地下城出征');
await page.locator('.grid3 .card', { hasText: '艾德里安' }).click();
await page.locator('.grid3 .card', { hasText: '薇拉' }).click();
await page.click('text=出征 ▶');
await page.waitForSelector('.dungeon');
await shot('06-explore-start');

const ROOM_PRIORITY = ['stairs', 'boss', 'guard', 'rest', 'empty', 'entry', 'side'];
let shotMid = false;
let shotBattle = false;
for (let step = 0; step < 600; step++) {
  const st = await page.evaluate(() => {
    const r = window.__game.getState().run;
    return { phase: r?.phase ?? 'none', battle: !!r?.battle, won: r?.battle?.result === 'victory' };
  });
  if (st.phase === 'explore' && st.won) {
    await page.locator('.overlay button', { hasText: '返回地图' }).click();
    continue;
  }
  if (st.phase === 'explore') {
    const stairs = page.locator('button', { hasText: '下楼' });
    if (await stairs.isVisible().catch(() => false)) {
      await shot(`07-stairs-${step}`);
      await stairs.click();
      continue;
    }
    const rooms = page.locator('.room.reachable');
    const n = await rooms.count();
    let best = null;
    let bestRank = 99;
    for (let i = 0; i < n; i++) {
      const kind = await rooms.nth(i).getAttribute('data-kind');
      const visited = (await rooms.nth(i).getAttribute('data-visited')) === 'true';
      const rank = ROOM_PRIORITY.indexOf(kind) + (visited ? 10 : 0);
      if (rank < bestRank) [best, bestRank] = [rooms.nth(i), rank];
    }
    await best.click();
    continue;
  }
  if (st.phase === 'done' || st.phase === 'none') break;
  if (!shotBattle) {
    shotBattle = true;
    await page.waitForSelector('.board');
    await shot('06-battle-start');
  }
  const bar = page.locator('.actionbar');
  if (!(await bar.isVisible().catch(() => false))) {
    await page.waitForTimeout(60);
    continue;
  }
  const exec = bar.locator('button', { hasText: '处决' });
  if (await exec.isEnabled()) {
    await exec.click();
    await page.locator('.tile.exec').first().click();
    continue;
  }
  const skills = bar.locator('button:not([disabled])');
  const n = await skills.count();
  let acted = false;
  for (let i = 0; i < n && !acted; i++) {
    const label = (await skills.nth(i).innerText()).trim();
    if (/防御|待机|结束|撤销|处决/.test(label)) continue;
    await skills.nth(i).click();
    const t = page.locator('.tile.target');
    if ((await t.count()) > 0) {
      await t.first().click();
      acted = true;
    }
  }
  if (acted) {
    if (!shotMid && step > 4) {
      shotMid = true;
      await page.waitForTimeout(150);
      await shot('08-battle-mid');
    }
    continue;
  }
  const moved = await page.evaluate(() => window.__game.getState().run?.battle?.turn.moved);
  const moves = page.locator('.tile.move');
  if (!moved && (await moves.count()) > 0) {
    await moves.nth(Math.floor((await moves.count()) / 3)).click();
    continue;
  }
  await bar.locator('button', { hasText: /待机|结束回合/ }).click();
}
await page.evaluate(() => window.__game.getState().setDebug({ enabled: true, heatmap: true }));
await page.waitForTimeout(200);
await shot('09-battle-end');
const doneBtn = page.locator('.overlay button', { hasText: '返回主城' });
if (await doneBtn.isVisible().catch(() => false)) await doneBtn.click();
await page.waitForTimeout(200);
await shot('10-report');

// resolve modals until clear
for (let i = 0; i < 6; i++) {
  const m = page.locator('.modal button').first();
  if (!(await m.isVisible().catch(() => false))) break;
  await m.click();
  await page.waitForTimeout(100);
}
await nav('夺舍仪式');
const pick = page.locator('button:not([disabled])', { hasText: '选为容器' }).first();
if (await pick.isVisible().catch(() => false)) {
  await pick.click();
  await shot('11-possession-pick');
  await page.click('text=执行继任仪式');
  await page.waitForTimeout(200);
  await shot('12-possession-done');
}

const state = await page.evaluate(() => {
  const g = window.__game.getState().game;
  return { month: g.month, gold: g.gold, members: g.members.map((m) => `${m.name}${m.isPatriarch ? '*' : ''}`), pool: g.soul.pool };
});
console.log(JSON.stringify(state));
console.log(errors.length ? errors.join('\n') : 'NO ERRORS');
await browser.close();
