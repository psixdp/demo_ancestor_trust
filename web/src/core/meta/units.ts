import { MEMORIES } from '../../config/memories';
import { activePassives, deriveStats } from '../character';
import type { Character, Soul, Unit } from '../types';

/** Build a battle unit from a family member. `hp` carries over between floors. */
export function unitFromCharacter(c: Character, soul: Soul, hp?: number): Unit {
  const st = deriveStats(c, soul);
  const skills = ['basic', ...st.skills];
  if (c.isPatriarch) {
    for (const id of soul.equipped) {
      const m = MEMORIES[id];
      if (m?.kind === 'active' && m.skill && !skills.includes(m.skill)) skills.push(m.skill);
    }
  }
  return {
    id: c.id,
    name: c.isPatriarch ? `族长·${c.name}` : c.name,
    side: 'ally',
    kind: c.isPatriarch ? 'patriarch' : 'child',
    charId: c.id,
    isBoss: false,
    x: 0,
    y: 0,
    facing: 0,
    hp: Math.min(st.hp, hp ?? st.hp),
    maxHp: st.hp,
    atk: st.atk,
    def: st.def,
    arm: st.arm,
    maxArm: st.arm,
    spd: st.spd,
    mov: st.mov,
    eva: st.eva,
    delayResist: st.delayResist,
    nextActAt: 0,
    turnCount: 0,
    breached: false,
    defending: false,
    downed: false,
    skills: skills.map((id) => ({ id, readyAt: 0 })),
    passives: [...st.passives, ...activePassives(c, soul)],
    personality: c.isPatriarch ? null : st.personality,
    devotion: c.devotion,
    suspicion: c.suspicion,
    aiType: 'child',
    interceptReady: true,
    nextAttackBonus: 0,
    order: null,
    holdDamageCut: false,
    spotted: false,
    tauntedBy: null,
    shaken: false,
    lastStandUsed: false,
    boss: null,
  };
}
