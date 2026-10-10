export type TargetKind =
  | 'melee' // adjacent 4-dir enemy
  | 'ray' // enemy within range with line of sight
  | 'line' // enemy in a straight line with clear path
  | 'sweep' // pick a direction, hits front tile and its two side neighbours
  | 'dash' // enemy in a straight line within range+1; move adjacent then strike
  | 'blink' // empty tile within range, counts as movement
  | 'enemyAny' // any enemy (orders)
  | 'self';

export interface SkillDef {
  id: string;
  name: string;
  target: TargetKind;
  range: number;
  mult: number;
  armorBreak: number;
  cooldown: number;
  knockback?: number;
  delay?: number;
  pull?: boolean;
  nextAttackBonus?: number;
  order?: 'focus' | 'hold';
  /** pure utility skills don't count as attacks for the AI */
  utility?: boolean;
  desc: string;
}

export const SKILLS: Record<string, SkillDef> = {
  basic: { id: 'basic', name: '普攻', target: 'melee', range: 1, mult: 1.0, armorBreak: 10, cooldown: 0, desc: '近战 1 格，倍率 1.0，破甲 10' },
  // innate (organ locus)
  bite: { id: 'bite', name: '撕咬', target: 'melee', range: 1, mult: 1.4, armorBreak: 10, cooldown: 1, desc: '近战，倍率 1.4，破甲 10' },
  ram: { id: 'ram', name: '冲撞', target: 'melee', range: 1, mult: 0.8, armorBreak: 10, cooldown: 2, knockback: 2, desc: '近战，倍率 0.8，击退 2 格' },
  acid: { id: 'acid', name: '腐蚀', target: 'melee', range: 1, mult: 0.6, armorBreak: 35, cooldown: 2, desc: '近战，倍率 0.6，破甲 35' },
  shieldBash: { id: 'shieldBash', name: '盾击', target: 'melee', range: 1, mult: 0.9, armorBreak: 20, cooldown: 2, knockback: 1, delay: 0.3, desc: '近战，倍率 0.9，击退 1 格，Delay 30%' },
  markShot: { id: 'markShot', name: '标记射击', target: 'ray', range: 3, mult: 1.0, armorBreak: 10, cooldown: 2, delay: 0.2, desc: '射程 3，倍率 1.0，Delay 20%' },
  // patriarch memories
  sweep: { id: 'sweep', name: '血刃横扫', target: 'sweep', range: 1, mult: 0.8, armorBreak: 15, cooldown: 1, desc: '前方及其左右共 3 格，倍率 0.8，破甲 15' },
  dash: { id: 'dash', name: '穿刺突进', target: 'dash', range: 2, mult: 1.3, armorBreak: 10, cooldown: 2, desc: '直线前冲至多 2 格后攻击，倍率 1.3' },
  chain: { id: 'chain', name: '血之锁链', target: 'line', range: 3, mult: 0.6, armorBreak: 10, cooldown: 2, pull: true, delay: 0.25, desc: '直线射程 3，拉到身边，Delay 25%' },
  blink: { id: 'blink', name: '夜幕步', target: 'blink', range: 3, mult: 0, armorBreak: 0, cooldown: 3, nextAttackBonus: 0.3, utility: true, desc: '瞬移至 3 格内空地（视为移动），下次攻击 +30%' },
  orderFocus: { id: 'orderFocus', name: '号令·集火', target: 'enemyAny', range: 99, mult: 0, armorBreak: 0, cooldown: 3, order: 'focus', utility: true, desc: '子嗣下次行动对该目标的攻击/破势 x2.0' },
  orderHold: { id: 'orderHold', name: '号令·死守', target: 'self', range: 0, mult: 0, armorBreak: 0, cooldown: 3, order: 'hold', utility: true, desc: '子嗣下次受伤 −30%，护驾 x1.5' },
  // enemies
  gunShot: { id: 'gunShot', name: '银弹射击', target: 'ray', range: 4, mult: 1.0, armorBreak: 10, cooldown: 0, desc: '射程 4' },
  enemyBash: { id: 'enemyBash', name: '圣铁盾击', target: 'melee', range: 1, mult: 0.9, armorBreak: 20, cooldown: 2, knockback: 1, desc: '击退 1 格' },
};
