import { BAL, FACILITIES, PARTNER_SOURCES } from '../../config/balance';
import { MEMORIES } from '../../config/memories';
import { isAdult, possessionPreview } from '../character';
import { Rng } from '../rng';
import type { FacilityId, GameState, MutationOrder, PartnerSource } from '../types';
import { EVENT_MAP } from './events';
import { addDevotion, addExp, addStress, addSuspicion, checkExperienceTraits, children, memberById, nextId, patriarch } from './growth';
import { advanceMonth } from './month';

export type ActionResult = { ok: true; msg?: string } | { ok: false; msg: string };
const fail = (msg: string): ActionResult => ({ ok: false, msg });
const ok = (msg?: string): ActionResult => ({ ok: true, msg });

function pushReportLine(g: GameState, line: string) {
  if (g.reports.length === 0 || g.reports[0].month !== g.month) g.reports.unshift({ month: g.month, lines: [] });
  g.reports[0].lines.push(line);
}

export function assignJob(g: GameState, charId: string, job: FacilityId | null): ActionResult {
  const c = memberById(g, charId);
  if (!c) return fail('成员不存在');
  if (job && !isAdult(c)) return fail('幼年成员不能上岗');
  if (job) {
    const count = g.members.filter((m) => m.job === job && m.id !== charId).length;
    if (count >= FACILITIES[job].cap) return fail(`${FACILITIES[job].name} 岗位已满`);
  }
  c.job = job;
  return ok();
}

export function train(g: GameState, charId: string): ActionResult {
  const c = memberById(g, charId);
  if (!c || c.isPatriarch) return fail('族长无需培训');
  if (c.monthFlags.trained) return fail('本月已培训');
  if (g.gold < BAL.trainCost) return fail('金币不足');
  g.gold -= BAL.trainCost;
  g.analytics.psycheSpending += BAL.trainCost;
  const before = c.devotion;
  addDevotion(c, BAL.trainDevotion);
  addExp(c, 'trainings', 1);
  c.monthFlags.trained = true;
  const lines: string[] = [];
  checkExperienceTraits(g, c, lines);
  lines.forEach((l) => pushReportLine(g, l));
  return ok(`${c.name} 参加了企业文化培训，狂信 ${before} → ${c.devotion}`);
}

export function treat(g: GameState, charId: string): ActionResult {
  const c = memberById(g, charId);
  if (!c) return fail('成员不存在');
  if (c.monthFlags.treated) return fail('本月已疗养');
  if (c.traumas.length === 0 && c.wear === 0) return fail('没有需要治疗的创伤');
  if (g.gold < BAL.treatCost) return fail('金币不足');
  g.gold -= BAL.treatCost;
  g.analytics.psycheSpending += BAL.treatCost;
  if (c.traumas.length > 0) c.traumas.shift();
  else c.wear -= 1;
  addStress(c, BAL.treatStress);
  c.monthFlags.treated = true;
  return ok(`${c.name} 完成疗养，移除 1 个创伤`);
}

export function counsel(g: GameState, charId: string, shadowId: string): ActionResult {
  const c = memberById(g, charId);
  if (!c || !c.shadows.includes(shadowId)) return fail('没有该阴影');
  if (c.monthFlags.counseled) return fail('本月已疏导');
  if (g.gold < BAL.counselCost) return fail('金币不足');
  g.gold -= BAL.counselCost;
  g.analytics.psycheSpending += BAL.counselCost;
  c.shadows = c.shadows.filter((s) => s !== shadowId);
  addSuspicion(c, BAL.counselSuspicion);
  c.monthFlags.counseled = true;
  return ok(`${c.name} 的【${MEMORIES[shadowId].name}】被疏导了。不过这次谈话让他想到了更多（疑心 +5）`);
}

export function holdGala(g: GameState): ActionResult {
  if (g.monthFlags.gala) return fail('本月已举办');
  if (g.gold < BAL.galaCost) return fail('金币不足');
  g.gold -= BAL.galaCost;
  g.analytics.psycheSpending += BAL.galaCost;
  for (const c of children(g)) {
    c.suspicion = Math.max(0, c.suspicion + BAL.galaSuspicion);
    addStress(c, BAL.galaStress);
  }
  g.monthFlags.gala = true;
  return ok('家族公益晚宴圆满落幕，全族疑心 −10');
}

export function breedWith(g: GameState, familyId: string, source: PartnerSource, partnerId: string): ActionResult {
  const fam = memberById(g, familyId);
  if (!fam) return fail('成员不存在');
  if (!isAdult(fam)) return fail('尚未成年');
  if (fam.breedCooldown > 0) return fail(`孕育冷却中（${fam.breedCooldown} 月）`);
  if (g.pregnancies.some((p) => p.familyId === familyId)) return fail('孕育中');
  if (PARTNER_SOURCES[source].tier === 'B' && g.tier !== 'B') return fail('需要家族阶层 B');
  const list = g.market[source];
  const partner = list.find((p) => p.id === partnerId);
  if (!partner) return fail('联姻对象不存在');
  if (g.gold < partner.fee) return fail('金币不足');
  g.gold -= partner.fee;
  g.market[source] = list.filter((p) => p.id !== partnerId);
  g.pregnancies.push({ id: nextId(g, 'preg'), familyId, familyName: fam.name, partner, monthsLeft: BAL.pregnancyMonths });
  fam.breedCooldown = BAL.breedCooldown;
  g.analytics.breedings += 1;
  let msg = `${fam.name} 与 ${partner.name} 签订了联姻合同，${BAL.pregnancyMonths} 个月后诞下子嗣`;
  if (source === 'dwarf' && !g.perks.debtCollateral) {
    g.perks.debtCollateral = true;
    msg += '。解锁家族红利【债务质押】';
  }
  if (source === 'elf' && !g.perks.workMonitor) {
    g.perks.workMonitor = true;
    msg += '。解锁家族红利【工时监控算法】';
  }
  return ok(msg);
}

export function orderMutation(g: GameState, order: MutationOrder): ActionResult {
  if (g.mutation) return fail('诱变室已有工单');
  const c = memberById(g, order.charId);
  if (!c) return fail('成员不存在');
  const cost = order.kind === 'activate' ? BAL.mutateActivate : BAL.mutateRandom;
  if (order.kind === 'activate' && !c.genome[order.locus][order.index].dormant) return fail('该等位基因并未休眠');
  if (g.mutagen < cost.mutagen) return fail('诱变原液不足（只能从地下城获得）');
  if (g.gold < cost.gold) return fail('金币不足');
  g.mutagen -= cost.mutagen;
  g.gold -= cost.gold;
  g.mutation = order;
  return ok('工单已提交，下月完成');
}

export function unlockMemory(g: GameState, id: string): ActionResult {
  const m = MEMORIES[id];
  if (!m || m.source !== 'xp') return fail('无法用历练点解锁');
  if (g.soul.pool.includes(id)) return fail('已解锁');
  if (g.soul.soulXP < (m.cost ?? 0)) return fail('历练点不足');
  g.soul.soulXP -= m.cost ?? 0;
  g.soul.pool.push(id);
  return ok(`解锁【${m.name}】`);
}

export function setEquipped(g: GameState, ids: string[]): ActionResult {
  const pat = patriarch(g);
  const unique = [...new Set(ids)].filter((id) => g.soul.pool.includes(id));
  if (unique.length > pat.activeSlots) return fail(`记忆槽只有 ${pat.activeSlots} 个`);
  g.soul.equipped = unique;
  return ok();
}

export function savePreset(g: GameState, which: 'battle' | 'work') {
  g.soul.presets[which] = [...g.soul.equipped];
}

export function loadPreset(g: GameState, which: 'battle' | 'work'): ActionResult {
  return setEquipped(g, g.soul.presets[which]);
}

export function tierUp(g: GameState): ActionResult {
  if (g.tier === 'B') return fail('已是 B 级');
  if (!g.license) return fail('需要先击败地下城首领获得特许经营牌照');
  if (g.gold < BAL.tierUpGold) return fail(`现金需达到 ${BAL.tierUpGold}`);
  g.gold -= BAL.tierUpCost;
  g.tier = 'B';
  return ok('家族晋升 B 级！解锁精灵资本联姻与地下城难度 II');
}

export function resolveEvent(g: GameState, optionIdx: number): ActionResult {
  const ev = g.pendingEvent;
  if (!ev) return fail('没有待处理事件');
  const def = EVENT_MAP[ev.eventId];
  const opt = def.options[optionIdx];
  const line = opt.apply(g, ev);
  pushReportLine(g, `【事件·${def.title}】${line}`);
  g.pendingEvent = null;
  return ok(line);
}

export function resolveTraitChoice(g: GameState, replaceTraitId: string | null): ActionResult {
  const pc = g.pendingTraitChoices[0];
  if (!pc) return fail('没有待选择的特性');
  const c = memberById(g, pc.charId);
  g.pendingTraitChoices.shift();
  if (!c) return ok();
  if (replaceTraitId === null) {
    c.declinedTraits.push(pc.traitId);
    return ok(`${c.name} 放弃了【${MEMORIES[pc.traitId].name}】`);
  }
  c.traits = c.traits.filter((t) => t !== replaceTraitId);
  c.declinedTraits.push(replaceTraitId);
  c.traits.push(pc.traitId);
  g.analytics.lostTraits += 1;
  return ok(`${c.name} 用【${MEMORIES[pc.traitId].name}】替换了【${MEMORIES[replaceTraitId].name}】`);
}

export function nextMonth(g: GameState): string[] {
  return advanceMonth(g);
}

// ---------- possession ----------

export function possessionCandidates(g: GameState) {
  return children(g)
    .filter(isAdult)
    .map((c) => ({ c, ...possessionPreview(c) }));
}

export function possess(g: GameState, containerId: string, equipped: string[]): ActionResult {
  const c = memberById(g, containerId);
  if (!c || c.isPatriarch) return fail('无效容器');
  if (!isAdult(c)) return fail('容器尚未成年');
  const pv = possessionPreview(c);
  if (pv.sync < BAL.possessionMinSync) return fail(`同步率不足 ${BAL.possessionMinSync}`);
  if (g.gold < BAL.possessionCost) return fail('金币不足（葬礼与公关费 500）');
  const old = patriarch(g);
  const rng = new Rng(g.rngState);
  g.gold -= BAL.possessionCost;

  const lines: string[] = [];
  lines.push(`【继任】董事长${old.name}于私人会客室突发心疾，享年 ${old.ageMonths} 月。新任董事长 ${c.name} 宣誓就职。`);

  const absorbed: string[] = [];
  const erased: string[] = [];
  for (const t of c.traits) {
    const def = MEMORIES[t];
    if (def.category === 'psyche') erased.push(def.name);
    else {
      absorbed.push(def.name);
      if (!g.soul.pool.includes(t)) g.soul.pool.push(t);
    }
  }
  for (const t of c.shadows) erased.push(MEMORIES[t].name);
  if (absorbed.length) lines.push(`【传承】吸收 ${c.name} 的后天特性：${absorbed.join('、')}`);
  if (erased.length) lines.push(`【抹除】随原意识一同消散：${erased.join('、')}`);

  g.analytics.possessions.push({
    month: g.month,
    containerSync: pv.sync,
    slots: pv.active,
    traits: c.traits.length,
    patriarchMonthsLeft: 0,
  });

  c.isPatriarch = true;
  c.syncMul = pv.syncMul;
  c.activeSlots = pv.active;
  c.traits = [];
  c.shadows = [];
  c.devotion = 0;
  c.suspicion = 0;
  c.stress = 0;
  g.members = g.members.filter((m) => m.id !== old.id);

  g.soul.stats.possessions += 1;
  g.soul.equipped = [...new Set(equipped)].filter((id) => g.soul.pool.includes(id)).slice(0, pv.active);

  for (const o of children(g)) {
    const mul = o.traits.includes('seasoned') ? 0.5 : 1;
    addSuspicion(o, BAL.possessionSuspicion * mul);
    addExp(o, 'possessionsWitnessed', 1);
  }
  lines.push(`【余波】全族对“父亲的突然离世”议论纷纷（疑心 +${BAL.possessionSuspicion}）。同步率 ${pv.sync}%，激活记忆槽 ${pv.active}。`);
  g.rngState = rng.state;
  advanceMonth(g, lines);
  return ok('继任仪式完成');
}
