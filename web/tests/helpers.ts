import type { BattleState, Side, Unit } from '../src/core/types';

export function unit(id: string, side: Side, x: number, y: number, over: Partial<Unit> = {}): Unit {
  return {
    id,
    name: id,
    side,
    kind: side === 'enemy' ? 'enemy' : id === 'pat' ? 'patriarch' : 'child',
    isBoss: false,
    x,
    y,
    facing: 0,
    hp: 10,
    maxHp: 10,
    atk: 1,
    def: 0,
    arm: 0,
    maxArm: 0,
    spd: 10,
    mov: 4,
    eva: 0,
    delayResist: false,
    nextActAt: 0,
    turnCount: 0,
    breached: false,
    defending: false,
    downed: false,
    skills: [],
    passives: [],
    personality: null,
    devotion: 0,
    suspicion: 0,
    aiType: side === 'enemy' ? 'hunter' : 'child',
    interceptReady: false,
    nextAttackBonus: 0,
    order: null,
    holdDamageCut: false,
    spotted: false,
    tauntedBy: null,
    shaken: false,
    lastStandUsed: false,
    boss: null,
    ...over,
  };
}

/** Open board with optional obstacle tiles. */
export function board(w: number, h: number, units: Unit[], obstacles: [number, number][] = []): BattleState {
  const blocked = new Array(w * h).fill(false);
  for (const [x, y] of obstacles) blocked[y * w + x] = true;
  return {
    w,
    h,
    blocked,
    units,
    activeId: units[0]?.id ?? null,
    turn: { moved: false, acted: false, startX: units[0]?.x ?? 0, startY: units[0]?.y ?? 0 },
    intelTypes: [],
  } as unknown as BattleState;
}
