import { isAdult } from '../character';
import type { Rng } from '../rng';
import type { GameState, PendingEvent } from '../types';
import { addSuspicion, children, memberById } from './growth';

export interface EventOption {
  label: string;
  apply: (g: GameState, ev: PendingEvent) => string;
}

export interface EventDef {
  id: string;
  title: string;
  text: (g: GameState, ev: PendingEvent) => string;
  canFire: (g: GameState) => boolean;
  pickTarget?: (g: GameState, rng: Rng) => string | undefined;
  options: EventOption[];
}

const mineWorkers = (g: GameState) => g.members.filter((m) => m.job === 'mine');

export const EVENTS: EventDef[] = [
  {
    id: 'reporter',
    title: '记者暗访',
    text: () => '《夜枭日报》的记者在血浆站附近徘徊，镜头对准了后门的冷链车。',
    canFire: () => true,
    options: [
      {
        label: '支付 200 金“广告合作费”',
        apply: (g) => {
          g.gold -= 200;
          return '报社收下了广告费，次日头版刊登《血月集团：城市的温暖心脏》。';
        },
      },
      {
        label: '拒绝',
        apply: (g) => {
          for (const c of children(g)) addSuspicion(c, 5);
          return '报道见报。家族成员在餐桌上读到了它，全族疑心 +5。';
        },
      },
    ],
  },
  {
    id: 'award',
    title: '慈善颁奖',
    text: () => '集团获评“年度最具人文关怀企业”，市长亲自颁发奖杯与补贴。',
    canFire: () => true,
    options: [
      {
        label: '领取补贴',
        apply: (g) => {
          g.gold += 300;
          return '获得 300 金政府补贴。董事长在台上哽咽：“这都是为了孩子们。”';
        },
      },
    ],
  },
  {
    id: 'diary',
    title: '日记风波',
    text: (g, ev) => {
      const c = memberById(g, ev.targetId ?? '');
      return `管家在 ${c?.name ?? '某位子嗣'} 的房间发现一本日记，最新一页写着：“父亲从不吃晚饭。”`;
    },
    canFire: (g) => children(g).some(isAdult),
    pickTarget: (g, rng) => {
      const adults = children(g).filter(isAdult);
      return adults.length ? rng.pick(adults).id : undefined;
    },
    options: [
      {
        label: '关怀谈话（50 金）',
        apply: (g, ev) => {
          const c = memberById(g, ev.targetId ?? '');
          g.gold -= 50;
          g.analytics.psycheSpending += 50;
          if (c) c.suspicion = Math.max(0, c.suspicion - 10);
          return `${c?.name} 在下午茶后放下了戒心（疑心 −10）。`;
        },
      },
      {
        label: '无视',
        apply: (g, ev) => {
          const c = memberById(g, ev.targetId ?? '');
          if (c) addSuspicion(c, 15);
          return `${c?.name} 开始留意父亲的作息（疑心 +15）。`;
        },
      },
    ],
  },
  {
    id: 'union',
    title: '工会请愿',
    text: () => '矿山员工联名要求“带薪休息”，请愿书上的签名比员工人数还多。',
    canFire: (g) => mineWorkers(g).length > 0,
    options: [
      {
        label: '同意',
        apply: (g) => {
          const loss = mineWorkers(g).length * 35;
          g.gold -= loss;
          for (const c of children(g)) c.suspicion = Math.max(0, c.suspicion - 3);
          return `矿山本月产出减半（−${loss} 金），全族疑心 −3。`;
        },
      },
      {
        label: '驳回',
        apply: (g) => {
          for (const c of mineWorkers(g)) addSuspicion(c, 5);
          return '请愿被驳回。矿山在岗成员疑心 +5。';
        },
      },
    ],
  },
];

export const EVENT_MAP: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));

export function rollEvent(g: GameState, rng: Rng): PendingEvent | null {
  const pool = EVENTS.filter((e) => e.canFire(g));
  if (pool.length === 0) return null;
  const ev = rng.pick(pool);
  return { eventId: ev.id, targetId: ev.pickTarget?.(g, rng) };
}
