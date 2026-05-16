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

/** POST /identify — image → pressing clues. */
export async function identifyCover(file) {
  const image = await fileToBase64(file);
  return postJson('/identify', { image });
}

/** POST /lookup — clues → ranked pressings with condition prices. */
export async function lookupDiscogs(clues) {
  return postJson('/lookup', clues);
}

/** POST /matrix — dead-wax photo → OCR text. */
export async function readMatrix(file) {
  const image = await fileToBase64(file);
  return postJson('/matrix', { image });
}

/** POST /live — release_id → live for-sale stats (lowest price, num listings). */
export async function fetchLive(releaseId) {
  return postJson('/live', { releaseId });
}
