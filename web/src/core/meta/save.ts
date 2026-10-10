import type { GameState } from '../types';

const PREFIX = 'ancestor-trust:';
export const AUTO_SLOT = 'auto';
export const SLOTS = ['1', '2', '3'];

export interface SlotInfo {
  slot: string;
  month: number;
  gold: number;
  savedAt: string;
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function saveGame(g: GameState, slot: string) {
  const st = storage();
  if (!st) return;
  st.setItem(PREFIX + slot, JSON.stringify({ savedAt: new Date().toISOString(), game: g }));
}

export function loadGame(slot: string): GameState | null {
  const raw = storage()?.getItem(PREFIX + slot);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { game: GameState };
    return data.game.version === 1 ? data.game : null;
  } catch {
    return null;
  }
}

export function slotInfo(slot: string): SlotInfo | null {
  const raw = storage()?.getItem(PREFIX + slot);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as { savedAt: string; game: GameState };
    return { slot, month: data.game.month, gold: data.game.gold, savedAt: data.savedAt };
  } catch {
    return null;
  }
}

export function deleteSlot(slot: string) {
  storage()?.removeItem(PREFIX + slot);
}

export function exportGame(g: GameState): string {
  return JSON.stringify(g);
}

export function importGame(text: string): GameState | null {
  try {
    const g = JSON.parse(text) as GameState;
    if (g.version !== 1 || !Array.isArray(g.members)) return null;
    return g;
  } catch {
    return null;
  }
}
