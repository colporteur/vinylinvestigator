// Svelte stores for app-wide state. Threshold persists to localStorage.

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const THRESHOLD_KEY = 'vi.threshold';
const DEFAULT_THRESHOLD = 10;

function readThreshold() {
  if (!browser) return DEFAULT_THRESHOLD;
  const raw = localStorage.getItem(THRESHOLD_KEY);
  const n = raw == null ? DEFAULT_THRESHOLD : parseFloat(raw);
  return Number.isFinite(n) && n >= 0 ? n : DEFAULT_THRESHOLD;
}

function createThresholdStore() {
  const { subscribe, set } = writable(readThreshold());
  return {
    subscribe,
    set: (v) => {
      if (browser) localStorage.setItem(THRESHOLD_KEY, String(v));
      set(v);
    }
  };
}

export const threshold = createThresholdStore();

// Currently-active view: 'scan' | 'history' | 'settings'
export const view = writable('scan');
