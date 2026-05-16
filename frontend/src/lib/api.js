// Thin client for the Cloudflare Worker backend.
// All secrets (Discogs token, Gemini key) live on the Worker, never here.

import { env } from '$env/dynamic/public';

const WORKER_URL = env.PUBLIC_WORKER_URL || '';

if (!WORKER_URL) {
  console.warn('PUBLIC_WORKER_URL is not set. The app will not be able to identify or look up records.');
}

async function postJson(path, body) {
  const res = await fetch(`${WORKER_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Convert a File/Blob to a base64-encoded data URL stripped of the prefix
 * (so the Worker can pass it straight to Gemini's inlineData field).
 */
async function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const dataUrl = r.result; // "data:image/jpeg;base64,...."
      const comma = dataUrl.indexOf(',');
      resolve({ mimeType: file.type || 'image/jpeg', data: dataUrl.slice(comma + 1) });
    };
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

/** POST /identify — cover photo → {artist, title, catalog_number?, label?, confidence} */
export async function identifyCover(file) {
  const image = await fileToBase64(file);
  return postJson('/identify', { image });
}

/** POST /lookup — {artist, title, catalog_number?} → {bestRelease, allReleases, maxPrice, medianPrice} */
export async function lookupDiscogs({ artist, title, catalogNumber }) {
  return postJson('/lookup', { artist, title, catalogNumber });
}

/** POST /matrix — dead-wax photo → {text} */
export async function readMatrix(file) {
  const image = await fileToBase64(file);
  return postJson('/matrix', { image });
}
