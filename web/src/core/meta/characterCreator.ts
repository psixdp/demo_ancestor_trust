import { BAL } from '../../config/balance';
import { CLASSES } from '../../config/classes';
import { MEMORIES } from '../../config/memories';
import type { BaseStats, Character, GameState, Genome } from '../types';
import type { ActionResult } from './actions';
import { nextId, patriarch } from './growth';

export const DEFAULT_TEMPLATE_ID = 'default';
const STORAGE_KEY = 'ancestor-trust:templates';

export interface CharacterTemplate {
  id: string;
  name: string;
  stats: BaseStats;
}

export const STAT_FIELDS: { key: keyof BaseStats; label: string; step: number }[] = [
  { key: 'hp', label: 'HP', step: 5 },
  { key: 'atk', label: 'ATK', step: 1 },
  { key: 'def', label: 'DEF', step: 1 },
  { key: 'arm', label: 'ARM', step: 5 },
  { key: 'spd', label: 'SPD', step: 5 },
  { key: 'mov', label: 'MOV', step: 1 },
  { key: 'eva', label: 'EVA', step: 0.01 },
];

export function defaultTemplate(): CharacterTemplate {
  return { id: DEFAULT_TEMPLATE_ID, name: '默认模板', stats: { ...BAL.baseStats } };
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** User templates live outside any save slot, so every save sees the same list. */
export function loadTemplates(): CharacterTemplate[] {
  const raw = storage()?.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    const list = JSON.parse(raw) as CharacterTemplate[];
    return Array.isArray(list) ? list.filter((t) => t && t.id && t.stats) : [];
  } catch {
    return [];
  }
}

function writeTemplates(list: CharacterTemplate[]) {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function saveTemplate(t: CharacterTemplate): CharacterTemplate[] {
  if (t.id === DEFAULT_TEMPLATE_ID) return loadTemplates();
  const list = loadTemplates();
  const i = list.findIndex((x) => x.id === t.id);
  if (i >= 0) list[i] = t;
  else list.push(t);
  writeTemplates(list);
  return list;
}

export function deleteTemplate(id: string): CharacterTemplate[] {
  const list = loadTemplates().filter((t) => t.id !== id);
  writeTemplates(list);
  return list;
}

export function newTemplateId(): string {
  return `tpl${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;
}

export interface CreatorSpec {
  name: string;
  template: CharacterTemplate;
  genome: Genome;
  classId: string | null;
  traits: string[];
  shadows: string[];
  ageMonths: number;
  devotion: number;
  suspicion: number;
  stress: number;
}

/** Character as it would be created, without touching the game; used for the live preview too. */
export function buildCharacter(g: GameState, spec: CreatorSpec, id = 'preview'): Character {
  const pat = patriarch(g);
  const custom = spec.template.id !== DEFAULT_TEMPLATE_ID;
  return {
    id,
    name: spec.name.trim() || '无名氏',
    generation: (pat?.generation ?? 1) + 1,
    ageMonths: spec.ageMonths,
    genome: structuredClone(spec.genome),
    traumas: [],
    wear: 0,
    parents: { family: '角色创建器', partner: spec.template.name },
    job: null,
    classId: spec.classId,
    ...(custom ? { baseTemplate: { name: spec.template.name, stats: { ...spec.template.stats } } } : {}),
    breedCooldown: 0,
    devotion: spec.devotion,
    suspicion: spec.suspicion,
    stress: spec.stress,
    experience: {},
    traits: [...spec.traits],
    shadows: [...spec.shadows],
    declinedTraits: [],
    isPatriarch: false,
    syncMul: 1,
    activeSlots: 0,
    monthFlags: {},
  };
}

export function createCharacter(g: GameState, spec: CreatorSpec): ActionResult {
  if (spec.ageMonths < BAL.adultAge) return { ok: false, msg: `年龄需 ≥ ${BAL.adultAge} 月（成年）` };
  if (spec.classId && !CLASSES[spec.classId]) return { ok: false, msg: '职业不存在' };
  if (spec.traits.length > BAL.childTraitCap) return { ok: false, msg: `后天特性最多 ${BAL.childTraitCap} 个` };
  if ([...spec.traits, ...spec.shadows].some((t) => !MEMORIES[t])) return { ok: false, msg: '存在无效的特性' };
  const c = buildCharacter(g, spec, nextId(g, 'c'));
  g.members.push(c);
  return { ok: true, msg: `${c.name} 加入了家族（${spec.template.name}）` };
}
