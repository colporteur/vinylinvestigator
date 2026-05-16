// IndexedDB-backed scan history using the `idb` wrapper.

import { openDB } from 'idb';
import { browser } from '$app/environment';

const DB_NAME = 'vinyl-investigator';
const DB_VERSION = 1;
const STORE = 'scans';

let dbPromise = null;

function getDb() {
  if (!browser) return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) {
          const store = db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
          store.createIndex('by-scannedAt', 'scannedAt');
          store.createIndex('by-flagged', 'flagged');
        }
      }
    });
  }
  return dbPromise;
}

/**
 * Persist a single scan result.
 * scan = { artist, title, bestRelease, maxPrice, medianPrice, flagged, matrix?, notes?, scannedAt }
 */
export async function saveScan(scan) {
  const db = await getDb();
  if (!db) return null;
  return db.add(STORE, { ...scan, scannedAt: scan.scannedAt ?? Date.now() });
}

export async function updateScan(id, patch) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.get(STORE, id);
  if (!existing) return;
  await db.put(STORE, { ...existing, ...patch });
}

export async function listScans({ flaggedOnly = false } = {}) {
  const db = await getDb();
  if (!db) return [];
  const all = await db.getAllFromIndex(STORE, 'by-scannedAt');
  const sorted = all.reverse(); // newest first
  return flaggedOnly ? sorted.filter((s) => s.flagged) : sorted;
}

export async function deleteScan(id) {
  const db = await getDb();
  if (!db) return;
  await db.delete(STORE, id);
}

export async function clearScans() {
  const db = await getDb();
  if (!db) return;
  await db.clear(STORE);
}
