import { BAL, FACILITIES } from '../../config/balance';
import { MEMORIES } from '../../config/memories';
import { FIRST_NAMES } from '../../config/texts';
import { hasPassive, isAdult } from '../character';
import { alleleName, breed, express, mutateAllele } from '../genetics';
import { Rng } from '../rng';
import type { Character, GameState } from '../types';
import { rollEvent } from './events';
import { addDevotion, addExp, addStress, addSuspicion, checkExperienceTraits, children, nextId, patriarch } from './growth';
import { refreshMarket } from './market';

export function monthlyIncome(g: GameState): { income: number; cost: number; detail: string[] } {
  let income = 0;
  const detail: string[] = [];
  for (const m of g.members) {
    if (!m.job || !isAdult(m)) continue;
    const f = FACILITIES[m.job];
    let out = f.output;
    if (m.job === 'plasma' && hasPassive(m, g.soul, 'plasmaVeteran')) out = Math.round(out * 1.3);
    income += out;
    detail.push(`${m.name}@${f.name.slice(0, 3)} +${out}`);
  }
  const cost = BAL.upkeep + BAL.livingCost * g.members.length;
  return { income, cost, detail };
}

function pickName(g: GameState, rng: Rng): string {
  const used = new Set(g.members.map((m) => m.name));
  const free = FIRST_NAMES.filter((n) => !used.has(n));
  return free.length ? rng.pick(free) : `${rng.pick(FIRST_NAMES)}${g.nextId}`;
}

function lostTraitsLine(g: GameState, c: Character, lines: string[]) {
  if (c.traits.length > 0) {
    g.analytics.lostTraits += c.traits.length;
    lines.push(`${c.name} 的毕生经验（${c.traits.map((t) => MEMORIES[t].name).join('、')}）随其一同埋葬。`);
  }
}

/** Monthly settlement. Mutates `g`, appends a report, and returns its lines. */
export function advanceMonth(g: GameState, preLines: string[] = []): string[] {
  const rng = new Rng(g.rngState);
  const lines: string[] = [...preLines];

  // 1. finance
  const fin = monthlyIncome(g);
  g.gold += fin.income - fin.cost;
  lines.push(`【财务】产出 +${fin.income}，维护与生活费 −${fin.cost}，结余 ${fin.income - fin.cost >= 0 ? '+' : ''}${fin.income - fin.cost}`);

  // 2. production
  if (g.mutation) {
    const o = g.mutation;
    const c = g.members.find((m) => m.id === o.charId);
    if (c) {
      if (o.kind === 'activate') {
        c.genome[o.locus][o.index].dormant = false;
        lines.push(`【诱变】${c.name} 的休眠性状【${alleleName(c.genome[o.locus][o.index].id)}】已激活`);
      } else {
        const before = alleleName(c.genome[o.locus][o.index].id);
        const after = alleleName(mutateAllele(c.genome, o.locus, o.index, rng));
        lines.push(`【诱变】${c.name} 的【${before}】突变为【${after}】`);
      }
    }
    g.mutation = null;
  }

  // 3. physiology
  for (const m of g.members) {
    const wasAdult = isAdult(m);
    m.ageMonths += 1;
    if (m.breedCooldown > 0) m.breedCooldown -= 1;
    if (!wasAdult && isAdult(m)) lines.push(`【成长】${m.name} 成年了，可以上岗、出征与转职`);
    const p = express(m.genome);
    if (m.ageMonths === p.agingStart) lines.push(`【衰老】${m.name} 进入衰老期`);
  }
  for (const preg of [...g.pregnancies]) {
    preg.monthsLeft -= 1;
    if (preg.monthsLeft <= 0) {
      const parent = g.members.find((m) => m.id === preg.familyId);
      const parentGenome = parent ? parent.genome : preg.partner.genome;
      const child: Character = {
        id: nextId(g, 'c'),
        name: pickName(g, rng),
        generation: (parent?.generation ?? 1) + 1,
        ageMonths: 0,
        genome: breed(parentGenome, preg.partner.genome, rng),
        traumas: [],
        wear: 0,
        parents: { family: preg.familyName, partner: preg.partner.name },
        job: null,
        classId: null,
        breedCooldown: 0,
        devotion: BAL.newbornDevotion,
        suspicion: 0,
        stress: 0,
        experience: {},
        traits: [],
        shadows: [],
        declinedTraits: [],
        isPatriarch: false,
        syncMul: 1,
        activeSlots: 0,
        monthFlags: {},
      };
      g.members.push(child);
      const ph = express(child.genome);
      lines.push(
        `【出生】${preg.familyName} 与 ${preg.partner.name} 的孩子 ${child.name} 出生（${ph.personality === 'zealot' ? '狂信' : ph.personality === 'paranoid' ? '多疑' : '迟钝'}，记忆槽 ${ph.slots}）`,
      );
      g.pregnancies = g.pregnancies.filter((x) => x.id !== preg.id);
    }
  }
  for (const m of [...g.members]) {
    const p = express(m.genome);
    if (m.ageMonths >= p.agingStart + BAL.agingDeathAfter) {
      if (m.isPatriarch) {
        g.gameOver = `族长 ${m.name} 的肉体于第 ${g.month} 月自然衰亡，未能完成继任仪式。真祖陨落。`;
        lines.push(g.gameOver);
      } else {
        lines.push(`【讣告】${m.name} 寿终正寝。集团为其举办了隆重的慈善追思会。`);
        lostTraitsLine(g, m, lines);
        g.members = g.members.filter((x) => x.id !== m.id);
      }
    }
  }

  // 4. psyche & experience
  for (const m of g.members) {
    if (m.job && isAdult(m)) addExp(m, m.job === 'plasma' ? 'plasmaMonths' : 'mineMonths', 1);
    if (m.isPatriarch) continue;
    if (isAdult(m)) addSuspicion(m, 1);
    addSuspicion(m, rng.int(-2, 3));
    if (m.job && isAdult(m)) addSuspicion(m, FACILITIES[m.job].suspicion);
    if (g.perks.workMonitor) m.suspicion = Math.max(0, m.suspicion - 1);
    if (m.suspicion >= 60) addDevotion(m, -2);
    addStress(m, -BAL.stressDecay);
  }

  // 5. social
  for (const m of children(g)) {
    if (m.suspicion >= 100) {
      lines.push(`【叛逃】${m.name} 带着全部基因离开了家族。《夜枭日报》：“豪门子弟毅然投身公益事业”。`);
      lostTraitsLine(g, m, lines);
      g.members = g.members.filter((x) => x.id !== m.id);
      g.analytics.defections += 1;
      continue;
    }
    if (m.suspicion >= 80 && rng.chance(BAL.informantChance)) {
      const fine = Math.round(BAL.informantFine * (g.perks.debtCollateral ? 0.5 : 1));
      g.gold -= fine;
      for (const o of children(g)) addSuspicion(o, 5);
      lines.push(`【告密】${m.name} 向监管机构递交了匿名举报。罚金 −${fine}，全族疑心 +5。`);
      g.analytics.informants += 1;
    }
  }
  for (const m of g.members) checkExperienceTraits(g, m, lines);

  g.market.refreshIn -= 1;
  if (g.market.refreshIn <= 0) {
    refreshMarket(g, rng);
    lines.push('【市场】联姻候选已刷新');
  }
  if (!g.gameOver && !g.pendingEvent && rng.chance(BAL.eventChance)) g.pendingEvent = rollEvent(g, rng);

  for (const m of g.members) m.monthFlags = {};
  g.monthFlags = { gala: false };
  const pat = patriarch(g);
  if (pat && !g.gameOver) {
    const left = express(pat.genome).agingStart + BAL.agingDeathAfter - pat.ageMonths;
    if (left <= 6) lines.push(`【警告】族长肉体预计 ${left} 个月后衰亡，请尽快安排继任仪式。`);
  }

  if (g.reports[0]?.month === g.month) {
    const early = g.reports.shift()!;
    lines.unshift(...early.lines);
  }
  g.reports.unshift({ month: g.month, lines });
  if (g.reports.length > 36) g.reports.length = 36;
  g.month += 1;
  g.rngState = rng.state;
  return lines;
}
