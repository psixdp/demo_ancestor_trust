import type { StatMods } from '../config/alleles';

// ---------- Genetics ----------
export type LocusId = 'L1' | 'L2' | 'L3' | 'L4' | 'L5' | 'L6';
export const LOCI: LocusId[] = ['L1', 'L2', 'L3', 'L4', 'L5', 'L6'];

export interface AlleleInstance {
  id: string;
  dormant: boolean;
}

export type Genome = Record<LocusId, [AlleleInstance, AlleleInstance]>;

export type Personality = 'docile' | 'zealot' | 'paranoid';

export interface Phenotype {
  slots: number;
  /** stat modifiers from all gene passives (co-dominant pairs averaged per locus) */
  mods: StatMods;
  /** `gene.*` passive ids of every expressed allele */
  passives: string[];
  personality: Personality;
  devotionMul: number;
  suspicionMul: number;
  agingStart: number;
  /** allele ids that are actually expressed on each locus */
  expressed: Record<LocusId, string[]>;
}

// ---------- Characters ----------
export type TraumaId = 'bone' | 'nerve' | 'organ' | 'blood';
export type FacilityId = 'plasma' | 'mine';
export type ExpKey =
  | 'intercepts'
  | 'breaches'
  | 'safeRetreats'
  | 'kills'
  | 'executions'
  | 'plasmaMonths'
  | 'mineMonths'
  | 'trainings'
  | 'possessionsWitnessed';

export interface BaseStats {
  hp: number;
  atk: number;
  def: number;
  arm: number;
  spd: number;
  mov: number;
  eva: number;
}

export interface Character {
  id: string;
  name: string;
  generation: number;
  ageMonths: number;
  genome: Genome;
  traumas: TraumaId[];
  /** extra defeats after the trauma cap, each −5% HP */
  wear: number;
  parents: { family: string; partner: string } | null;
  job: FacilityId | null;
  /** combat class; belongs to the body, so a possessed container keeps it */
  classId: string | null;
  /** test-only base stat template from the character creator; offspring and possessed bodies use the shared one */
  baseTemplate?: { name: string; stats: BaseStats };
  breedCooldown: number;
  devotion: number;
  suspicion: number;
  stress: number;
  experience: Partial<Record<ExpKey, number>>;
  /** positive acquired traits (children only; the patriarch's go straight into the soul pool) */
  traits: string[];
  /** negative stress outcomes, not counted against the trait cap */
  shadows: string[];
  /** experience traits the player chose not to keep; never offered again */
  declinedTraits: string[];
  isPatriarch: boolean;
  /** patriarch only: stat inheritance coefficient from possession sync */
  syncMul: number;
  /** patriarch only: activated memory slots */
  activeSlots: number;
  monthFlags: { trained?: boolean; treated?: boolean; counseled?: boolean };
}

export type PartnerSource = 'labor' | 'dwarf' | 'elf';

export interface Partner {
  id: string;
  name: string;
  source: PartnerSource;
  genome: Genome;
  fee: number;
}

export interface Pregnancy {
  id: string;
  familyId: string;
  familyName: string;
  partner: Partner;
  monthsLeft: number;
}

export interface MutationOrder {
  kind: 'activate' | 'mutate';
  charId: string;
  locus: LocusId;
  index: 0 | 1;
}

export interface SoulStats {
  battles: number;
  defeats: number;
  possessions: number;
  bossKills: number;
}

export interface Soul {
  soulXP: number;
  pool: string[];
  equipped: string[];
  presets: { battle: string[]; work: string[] };
  intel: Record<string, number>;
  stats: SoulStats;
}

export interface MonthReport {
  month: number;
  lines: string[];
}

export interface PendingEvent {
  eventId: string;
  targetId?: string;
}

export interface PendingTraitChoice {
  charId: string;
  traitId: string;
}

export interface Analytics {
  battles: number;
  aiBreaches: number;
  executionsOnAiBreach: number;
  intercepts: number;
  intentCounts: Record<string, Record<string, number>>;
  stanceSwitches: number;
  defeats: number;
  possessions: { month: number; containerSync: number; slots: number; traits: number; patriarchMonthsLeft: number }[];
  psycheSpending: number;
  informants: number;
  defections: number;
  breedings: number;
  lostTraits: number;
  stressAwaken: number;
  stressShadow: number;
}

export interface GameState {
  version: 1;
  seed: number;
  rngState: number;
  month: number;
  gold: number;
  mutagen: number;
  tier: 'C' | 'B';
  license: boolean;
  members: Character[];
  pregnancies: Pregnancy[];
  market: { labor: Partner[]; dwarf: Partner[]; elf: Partner[]; refreshIn: number };
  perks: { debtCollateral: boolean; workMonitor: boolean };
  soul: Soul;
  mutation: MutationOrder | null;
  monthFlags: { gala: boolean };
  reports: MonthReport[];
  pendingEvent: PendingEvent | null;
  pendingTraitChoices: PendingTraitChoice[];
  gameOver: string | null;
  nextId: number;
  analytics: Analytics;
}

// ---------- Battle ----------
export type Side = 'ally' | 'enemy';
/** 0 up, 1 right, 2 down, 3 left */
export type Dir = 0 | 1 | 2 | 3;
export type Stance = 'guard' | 'assault' | 'self';
export type AiType = 'child' | 'hunter' | 'beast' | 'shield' | 'boss';
export type Intent = 'attack' | 'break' | 'guard' | 'retreat' | 'regroup' | 'defend' | 'advance';

export interface SkillState {
  id: string;
  readyAt: number;
}

export interface BossState {
  step: number;
  crossTiles: [number, number][] | null;
  markTarget: string | null;
}

export interface Unit {
  id: string;
  name: string;
  side: Side;
  kind: 'patriarch' | 'child' | 'enemy';
  charId?: string;
  enemyType?: string;
  isBoss: boolean;
  x: number;
  y: number;
  facing: Dir;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  arm: number;
  maxArm: number;
  spd: number;
  mov: number;
  eva: number;
  delayResist: boolean;
  nextActAt: number;
  turnCount: number;
  breached: boolean;
  defending: boolean;
  downed: boolean;
  skills: SkillState[];
  /** active passive memory/trait ids */
  passives: string[];
  personality: Personality | null;
  devotion: number;
  suspicion: number;
  aiType: AiType;
  interceptReady: boolean;
  nextAttackBonus: number;
  order: { kind: 'focus'; targetId: string } | { kind: 'hold' } | null;
  holdDamageCut: boolean;
  /** delayed by a spotter; takes extra patriarch damage until its next turn */
  spotted: boolean;
  /** unit id that taunted this unit; cleared when this unit ends its turn */
  tauntedBy: string | null;
  shaken: boolean;
  lastStandUsed: boolean;
  boss: BossState | null;
}

export interface BattleFx {
  id: number;
  kind: 'dmg' | 'heal' | 'bubble' | 'text';
  unitId: string;
  text: string;
}

export interface FactorBreakdown {
  intent: Intent;
  base: number;
  suit: number;
  personality: number;
  stance: number;
  psyche: number;
  extra: number;
  score: number;
}

export interface Candidate {
  x: number;
  y: number;
  skillId: string | null;
  /** 'wait' | 'defend' | 'skill' */
  action: 'wait' | 'defend' | 'skill';
  targetId: string | null;
  dir: Dir | null;
  path: [number, number][];
}

export interface ScoredCandidate {
  cand: Candidate;
  score: number;
  mainIntent: Intent;
  factors: FactorBreakdown[];
  label: string;
}

export interface AiDecisionRecord {
  seq: number;
  unitId: string;
  unitName: string;
  top: ScoredCandidate[];
  heat: Record<string, number>;
  /** unit position before acting */
  from: [number, number];
  slacked: boolean;
}

export interface UnitTally {
  downed: boolean;
  allyDowned: number;
  heavyHits: number;
  bossHits: number;
  intercepts: number;
  breaches: number;
  safeRetreats: number;
  kills: number;
  executions: number;
  intents: Record<string, number>;
  damageTaken: number;
}

export interface BattleState {
  w: number;
  h: number;
  blocked: boolean[];
  units: Unit[];
  stance: Stance;
  activeId: string | null;
  turn: { moved: boolean; acted: boolean; startX: number; startY: number };
  log: string[];
  fx: BattleFx[];
  fxSeq: number;
  decisions: AiDecisionRecord[];
  result: 'victory' | 'defeat' | null;
  floor: number;
  isBossFloor: boolean;
  difficulty: 1 | 2;
  rngState: number;
  tally: Record<string, UnitTally>;
  killsByType: Record<string, number>;
  retreatWatch: Record<string, boolean>;
  aiBreachIds: string[];
  executionsOnAiBreach: number;
  stanceSwitches: number;
  /** enemy types the patriarch has intel on (+15% damage) */
  intelTypes: string[];
  executeKillRefund: boolean;
  defendedThisTurn: boolean;
  aiSeq: number;
}
