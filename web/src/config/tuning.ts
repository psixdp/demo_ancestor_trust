import { PERSONALITY_NAMES } from './alleles';
import { BAL, ENEMY_MOD, INTENT_BASE, INTENT_NAMES, INTERCEPT_FACTOR, PERSONALITY_MOD, STANCE_MOD, STANCE_NAMES } from './balance';

/** Runtime-editable tables. Values are mutated in place, so every reader sees edits immediately. */
const ROOTS = { BAL, INTENT_BASE, PERSONALITY_MOD, INTERCEPT_FACTOR, STANCE_MOD, ENEMY_MOD } as unknown as Record<string, Record<string, unknown>>;
const DEFAULTS = structuredClone(ROOTS);
const STORAGE_KEY = 'ancestor-trust:tuning';

export interface TuningField {
  /** dot path starting with a root name, e.g. `BAL.baseStats.hp` */
  path: string;
  label: string;
  /** step in display units */
  step: number;
  min?: number;
  max?: number;
  /** stored as a fraction, shown as a percentage */
  pct?: boolean;
  hint?: string;
}

export interface TuningMatrixAxis {
  key: string;
  label: string;
}

export type TuningGroup =
  | { id: string; name: string; kind: 'list'; fields: TuningField[]; hint?: string }
  | { id: string; name: string; kind: 'matrix'; root: string; rows: TuningMatrixAxis[]; cols: TuningMatrixAxis[]; step: number; hint?: string };

const f = (path: string, label: string, step: number, extra: Partial<TuningField> = {}): TuningField => ({ path: `BAL.${path}`, label, step, min: 0, ...extra });

const INTENTS = Object.entries(INTENT_NAMES).map(([key, label]) => ({ key, label }));
const PERSONALITIES = Object.entries(PERSONALITY_NAMES).map(([key, label]) => ({ key, label }));
const ENEMY_TYPES: TuningMatrixAxis[] = [
  { key: 'hunter', label: '猎魔人' },
  { key: 'beast', label: '野兽' },
  { key: 'shield', label: '重盾' },
  { key: 'boss', label: '首领' },
];

export const TUNING_GROUPS: TuningGroup[] = [
  {
    id: 'start',
    name: '开局与族长',
    kind: 'list',
    fields: [f('startGold', '开局金币', 100), f('patriarchBonusHp', '族长灵魂加成 HP', 5), f('patriarchBonusAtk', '族长灵魂加成 ATK', 1)],
  },
  {
    id: 'baseStats',
    name: '属性模板',
    kind: 'list',
    hint: '所有角色共用的基础属性，基因与职业在此之上修正。角色创建器的「默认模板」也读这里。',
    fields: [
      f('baseStats.hp', 'HP', 5, { min: 1 }),
      f('baseStats.atk', 'ATK', 1, { min: 1 }),
      f('baseStats.def', 'DEF', 1),
      f('baseStats.arm', 'ARM', 5),
      f('baseStats.spd', 'SPD', 5, { min: 1 }),
      f('baseStats.mov', 'MOV', 1, { min: 1 }),
      f('baseStats.eva', 'EVA', 1, { pct: true, max: 1 }),
    ],
  },
  {
    id: 'growth',
    name: '成长与衰老',
    kind: 'list',
    fields: [
      f('adultAge', '成年月龄', 1, { min: 1 }),
      f('pregnancyMonths', '孕期（月）', 1, { min: 1 }),
      f('breedCooldown', '孕育冷却（月）', 1),
      f('agingDeathAfter', '衰老后自然死亡（月）', 1, { min: 1 }),
      f('agingSpdPerMonth', '衰老每月 SPD 下降', 1),
      f('agingHpPctPerMonth', '衰老每月 HP 下降', 0.5, { pct: true, max: 1 }),
      f('newbornDevotion', '新生儿初始狂信', 5, { max: 100 }),
    ],
  },
  {
    id: 'economy',
    name: '经营开销',
    kind: 'list',
    fields: [f('upkeep', '月度维护费', 10), f('livingCost', '每人每月生活费', 5)],
  },
  {
    id: 'psyche',
    name: '心理操作',
    kind: 'list',
    hint: '变化量为负表示降低。',
    fields: [
      f('trainCost', '企业文化培训费用', 10),
      f('trainDevotion', '培训狂信增加', 1),
      f('galaCost', '公益晚宴费用', 50),
      f('galaSuspicion', '晚宴全族疑心变化', 1, { min: -100, max: 100 }),
      f('galaStress', '晚宴全族应激变化', 1, { min: -100, max: 100 }),
      f('treatCost', '疗养费用', 50),
      f('treatStress', '疗养应激变化', 1, { min: -100, max: 100 }),
      f('counselCost', '疏导费用', 50),
      f('counselSuspicion', '疏导疑心变化', 1, { min: -100, max: 100 }),
    ],
  },
  {
    id: 'possession',
    name: '夺舍',
    kind: 'list',
    fields: [
      f('possessionCost', '夺舍费用', 50),
      f('possessionSuspicion', '夺舍后全族疑心', 1, { max: 100 }),
      f('possessionMinSync', '最低同步率', 1, { max: 100 }),
    ],
  },
  {
    id: 'informant',
    name: '告密',
    kind: 'list',
    fields: [f('informantFine', '告密罚金', 50), f('informantChance', '疑心≥80 时每月告密概率', 1, { pct: true, max: 1 })],
  },
  {
    id: 'tier',
    name: '阶层与市场',
    kind: 'list',
    fields: [
      f('tierUpGold', '晋升 B 级现金门槛', 100),
      f('tierUpCost', '晋升 B 级费用', 100),
      f('marketRefresh', '联姻市场刷新间隔（月）', 1, { min: 1 }),
      f('eventChance', '月度随机事件概率', 5, { pct: true, max: 1 }),
    ],
  },
  {
    id: 'mutate',
    name: '诱变',
    kind: 'list',
    fields: [
      f('mutateActivate.mutagen', '激活休眠：原液', 1),
      f('mutateActivate.gold', '激活休眠：金币', 50),
      f('mutateRandom.mutagen', '随机突变：原液', 1),
      f('mutateRandom.gold', '随机突变：金币', 50),
    ],
  },
  {
    id: 'expedition',
    name: '出征结算',
    kind: 'list',
    fields: [
      f('floorHeal', '层间回复（最大生命）', 5, { pct: true, max: 1 }),
      f('defeatLootLoss', '战败战利品损失', 5, { pct: true, max: 1 }),
      f('maxTraumas', '创伤上限', 1, { min: 1 }),
      f('childTraitCap', '子嗣后天特性位', 1, { min: 1 }),
    ],
  },
  {
    id: 'xp',
    name: '历练与敌情',
    kind: 'list',
    fields: [
      f('xpKill', '每次击杀历练点', 1),
      f('xpFloor', '每通关一层历练点', 1),
      f('xpBoss', '击杀首领历练点', 5),
      f('intelThreshold', '敌情解析所需击杀数', 1, { min: 1 }),
    ],
  },
  {
    id: 'stress',
    name: '应激',
    kind: 'list',
    fields: [f('stressDecay', '每月应激自然回落', 1, { max: 100 }), f('stressResetAfterCheck', '应激判定后重置为', 5, { max: 100 })],
  },
  {
    id: 'intentBase',
    name: 'AI：意图基础分',
    kind: 'list',
    hint: '候选得分 = 基础分 × 战况适宜度 × 性格 × 态势 × 心理修正。',
    fields: INTENTS.map(({ key, label }) => ({ path: `INTENT_BASE.${key}`, label, step: 0.05, min: 0 })),
  },
  {
    id: 'personality',
    name: 'AI：性格修正',
    kind: 'matrix',
    root: 'PERSONALITY_MOD',
    rows: PERSONALITIES,
    cols: INTENTS,
    step: 0.1,
  },
  {
    id: 'intercept',
    name: 'AI：反应拦截系数',
    kind: 'list',
    hint: '拦截概率 = 狂信度 / 100 × 系数。',
    fields: PERSONALITIES.map(({ key, label }) => ({ path: `INTERCEPT_FACTOR.${key}`, label, step: 0.05, min: 0, max: 1 })),
  },
  {
    id: 'stance',
    name: 'AI：态势修正',
    kind: 'matrix',
    root: 'STANCE_MOD',
    rows: Object.entries(STANCE_NAMES).map(([key, label]) => ({ key, label })),
    cols: INTENTS,
    step: 0.1,
  },
  {
    id: 'enemy',
    name: 'AI：敌人意图修正',
    kind: 'matrix',
    root: 'ENEMY_MOD',
    rows: ENEMY_TYPES,
    cols: INTENTS,
    step: 0.1,
  },
];

function lookup(tree: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), tree);
}

/** Matrix cells that do not exist in the defaults (e.g. a personality with no `defend` entry) stay absent. */
export function matrixCellPath(root: string, row: string, col: string): string | null {
  const path = `${root}.${row}.${col}`;
  return typeof lookup(DEFAULTS, path) === 'number' ? path : null;
}

function fieldsOf(g: TuningGroup): TuningField[] {
  if (g.kind === 'list') return g.fields;
  const out: TuningField[] = [];
  for (const r of g.rows)
    for (const c of g.cols) {
      const path = matrixCellPath(g.root, r.key, c.key);
      if (path) out.push({ path, label: `${r.label}·${c.label}`, step: g.step, min: 0 });
    }
  return out;
}

export const TUNING_FIELDS: Record<string, TuningField> = Object.fromEntries(TUNING_GROUPS.flatMap(fieldsOf).map((x) => [x.path, x]));

export function groupPaths(id: string): string[] {
  const g = TUNING_GROUPS.find((x) => x.id === id);
  return g ? fieldsOf(g).map((x) => x.path) : [];
}

/** Every numeric leaf in the editable tables; tests check each one has a field. */
export function numericLeaves(tree: Record<string, unknown> = DEFAULTS, prefix = ''): string[] {
  return Object.entries(tree).flatMap(([k, v]) => {
    const p = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'number') return [p];
    if (v && typeof v === 'object') return numericLeaves(v as Record<string, unknown>, p);
    return [];
  });
}

export function getValue(path: string): number {
  return lookup(ROOTS, path) as number;
}

export function defaultValue(path: string): number {
  return lookup(DEFAULTS, path) as number;
}

function write(path: string, v: number) {
  const keys = path.split('.');
  const last = keys.pop()!;
  (lookup(ROOTS, keys.join('.')) as Record<string, number>)[last] = v;
}

let overrides: Record<string, number> = {};

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

function persist() {
  const st = storage();
  if (!st) return;
  if (Object.keys(overrides).length) st.setItem(STORAGE_KEY, JSON.stringify(overrides));
  else st.removeItem(STORAGE_KEY);
}

export function getOverrides(): Record<string, number> {
  return { ...overrides };
}

export function isModified(path: string): boolean {
  return path in overrides;
}

/** Returns false for unknown paths or non-finite numbers. */
export function setValue(path: string, v: number, save = true): boolean {
  if (!TUNING_FIELDS[path] || !Number.isFinite(v)) return false;
  write(path, v);
  if (v === defaultValue(path)) delete overrides[path];
  else overrides[path] = v;
  if (save) persist();
  return true;
}

export function resetField(path: string) {
  setValue(path, defaultValue(path));
}

export function resetGroup(id: string) {
  for (const p of groupPaths(id)) setValue(p, defaultValue(p), false);
  persist();
}

export function resetAll() {
  for (const p of Object.keys(TUNING_FIELDS)) write(p, defaultValue(p));
  overrides = {};
  persist();
}

function applyAll(map: Record<string, unknown>): { applied: number; ignored: number } {
  resetAll();
  let applied = 0;
  let ignored = 0;
  for (const [p, v] of Object.entries(map)) {
    if (typeof v === 'number' && setValue(p, v, false)) applied++;
    else ignored++;
  }
  persist();
  return { applied, ignored };
}

/** Call once before rendering. */
export function loadTuning() {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const map = JSON.parse(raw);
    if (map && typeof map === 'object') applyAll(map);
  } catch {
    storage()?.removeItem(STORAGE_KEY);
  }
}

export function exportTuning(): string {
  return JSON.stringify({ version: 1, overrides }, null, 2);
}

/** Replaces current overrides. Accepts the export format or a flat `{ path: number }` map. */
export function importTuning(text: string): { ok: true; applied: number; ignored: number } | { ok: false; msg: string } {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, msg: 'JSON 格式错误' };
  }
  if (!data || typeof data !== 'object') return { ok: false, msg: '内容不是对象' };
  const d = data as { overrides?: unknown };
  const map = d.overrides && typeof d.overrides === 'object' ? d.overrides : data;
  return { ok: true, ...applyAll(map as Record<string, unknown>) };
}
