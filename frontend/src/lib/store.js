// Svelte stores for app-wide state. Persisted preferences live in localStorage.

import { writable } from 'svelte/store';
import { browser } from '$app/environment';

const CONDITION_KEY = 'vi.defaultCondition';
const DEFAULT_CONDITION = 'VG';
export const CONDITION_OPTIONS = ['M', 'NM', 'VG+', 'VG', 'G+', 'G'];

function read(key, fallback) {
  if (!browser) return fallback;
  const raw = localStorage.getItem(key);
  return raw == null ? fallback : raw;
}

function persisted(key, fallback) {
  const { subscribe, set } = writable(read(key, fallback));
  return {
    subscribe,
    set: (v) => {
      if (browser) localStorage.setItem(key, String(v));
      set(v);
    }
  };
}

export const defaultCondition = persisted(CONDITION_KEY, DEFAULT_CONDITION);

// Currently-active view: 'scan' | 'history' | 'settings'
export const view = writable('scan');
