import { create } from 'zustand';
import * as A from '../core/meta/actions';
import * as X from '../core/meta/expedition';
import type { RunState } from '../core/meta/expedition';
import { createNewGame } from '../core/meta/newGame';
import { AUTO_SLOT, importGame, loadGame, saveGame } from '../core/meta/save';
import { randomSeed } from '../core/rng';
import type { BattleState, GameState } from '../core/types';

export type Screen = 'title' | 'hub' | 'battle';
export type Tab = 'family' | 'marriage' | 'facilities' | 'memory' | 'possession' | 'expedition' | 'reports' | 'debug' | 'creator' | 'tuning';

export interface DebugFlags {
  enabled: boolean;
  aiPanel: boolean;
  heatmap: boolean;
  stepMode: boolean;
}

interface Toast {
  id: number;
  text: string;
  ok: boolean;
}

interface Store {
  game: GameState | null;
  run: RunState | null;
  screen: Screen;
  tab: Tab;
  toasts: Toast[];
  report: { title: string; lines: string[] } | null;
  debug: DebugFlags;
  aiDelay: number;

  newGame(seed?: number): void;
  loadSlot(slot: string): boolean;
  saveSlot(slot: string): void;
  importJson(text: string): boolean;
  toTitle(): void;
  setTab(t: Tab): void;
  toast(text: string, ok?: boolean): void;
  dismissReport(): void;
  setDebug(p: Partial<DebugFlags>): void;
  setAiDelay(ms: number): void;

  /** Run a hub action on a cloned game state. */
  act(fn: (g: GameState) => A.ActionResult | void): A.ActionResult | void;
  /** Free-form edit for debug tools. */
  edit(fn: (g: GameState) => void): void;
  nextMonth(): void;
  possess(containerId: string, equipped: string[]): void;

  startRun(childIds: string[], difficulty: 1 | 2, bloodBags?: number): void;
  battle(fn: (b: BattleState) => unknown): void;
  /** Exploration actions on a cloned run and game. */
  explore(fn: (g: GameState, run: RunState) => unknown): void;
  moveTo(roomId: number): void;
  useRest(): void;
  useBloodBag(charId: string): void;
  takeStairs(): void;
  leaveBattle(): void;
  retreatRun(): void;
  settleRun(): void;
}

let toastSeq = 0;

function persist(g: GameState) {
  saveGame(g, AUTO_SLOT);
}

export const useGame = create<Store>((set, get) => ({
  game: null,
  run: null,
  screen: 'title',
  tab: 'family',
  toasts: [],
  report: null,
  debug: { enabled: false, aiPanel: true, heatmap: false, stepMode: false },
  aiDelay: 450,

  newGame(seed) {
    const g = createNewGame(seed ?? randomSeed());
    persist(g);
    set({ game: g, run: null, screen: 'hub', tab: 'family', report: null });
  },
  loadSlot(slot) {
    const g = loadGame(slot);
    if (!g) return false;
    set({ game: g, run: null, screen: 'hub', report: null });
    return true;
  },
  saveSlot(slot) {
    const g = get().game;
    if (g) {
      saveGame(g, slot);
      get().toast(`已保存到存档 ${slot}`);
    }
  },
  importJson(text) {
    const g = importGame(text);
    if (!g) return false;
    persist(g);
    set({ game: g, run: null, screen: 'hub', report: null });
    return true;
  },
  toTitle() {
    set({ screen: 'title', run: null });
  },
  setTab(t) {
    set({ tab: t });
  },
  toast(text, ok = true) {
    const t = { id: ++toastSeq, text, ok };
    set({ toasts: [...get().toasts.slice(-3), t] });
    setTimeout(() => set({ toasts: get().toasts.filter((x) => x.id !== t.id) }), 2600);
  },
  dismissReport() {
    set({ report: null });
  },
  setDebug(p) {
    set({ debug: { ...get().debug, ...p } });
  },
  setAiDelay(ms) {
    set({ aiDelay: ms });
  },

  act(fn) {
    const cur = get().game;
    if (!cur) return;
    const g = structuredClone(cur);
    const res = fn(g);
    if (res && !res.ok) {
      get().toast(res.msg, false);
      return res;
    }
    persist(g);
    set({ game: g });
    if (res?.msg) get().toast(res.msg);
    return res;
  },
  edit(fn) {
    const cur = get().game;
    if (!cur) return;
    const g = structuredClone(cur);
    fn(g);
    persist(g);
    set({ game: g });
  },
  nextMonth() {
    const cur = get().game;
    if (!cur) return;
    const g = structuredClone(cur);
    const month = g.month;
    const lines = A.nextMonth(g);
    persist(g);
    set({ game: g, report: { title: `第 ${month} 月 月度报告`, lines } });
  },
  possess(containerId, equipped) {
    const cur = get().game;
    if (!cur) return;
    const g = structuredClone(cur);
    const month = g.month;
    const res = A.possess(g, containerId, equipped);
    if (!res.ok) {
      get().toast(res.msg, false);
      return;
    }
    persist(g);
    set({ game: g, tab: 'family', report: { title: `第 ${month} 月 · 继任仪式`, lines: g.reports[0]?.lines ?? [] } });
  },

  startRun(childIds, difficulty, bloodBags = 0) {
    const cur = get().game;
    if (!cur) return;
    const g = structuredClone(cur);
    const res = X.startRun(g, childIds, difficulty, bloodBags);
    if (!res.ok) {
      get().toast(res.msg, false);
      return;
    }
    set({ game: g, run: res.run, screen: 'battle' });
  },
  battle(fn) {
    const { run: curRun, game: curGame } = get();
    if (!curRun?.battle || !curGame || curRun.phase !== 'battle') return;
    const run = structuredClone(curRun);
    fn(run.battle!);
    if (run.battle!.result) {
      const g = structuredClone(curGame);
      X.finishBattle(g, run);
      set({ run, game: g });
    } else {
      set({ run });
    }
  },
  explore(fn) {
    const { run: curRun, game: curGame } = get();
    if (!curRun || !curGame) return;
    const run = structuredClone(curRun);
    const g = structuredClone(curGame);
    fn(g, run);
    set({ run, game: g });
  },
  moveTo(roomId) {
    get().explore((g, run) => X.moveTo(g, run, roomId));
  },
  useRest() {
    get().explore((g, run) => X.useRest(g, run));
  },
  useBloodBag(charId) {
    get().explore((g, run) => X.useBloodBag(g, run, charId));
  },
  takeStairs() {
    get().explore((g, run) => X.takeStairs(g, run));
  },
  leaveBattle() {
    get().explore((_, run) => X.leaveBattle(run));
  },
  retreatRun() {
    get().explore((_, run) => X.retreatRun(run));
  },
  settleRun() {
    const { run, game: curGame } = get();
    if (!run || !curGame || run.phase !== 'done') return;
    const g = structuredClone(curGame);
    const month = g.month;
    const lines = X.settleRun(g, run);
    persist(g);
    set({ game: g, run: null, screen: 'hub', report: { title: `第 ${month} 月 · 出征与月度报告`, lines } });
  },
}));
