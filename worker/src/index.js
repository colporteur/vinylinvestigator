// Cloudflare Worker: proxies vision (Gemini) and marketplace data (Discogs)
// so that secrets never reach the browser.
//
// Endpoints:
//   POST /identify   { image: { mimeType, data } } -> { artist, title, catalog_number?, label?, confidence }
//   POST /lookup     { artist, title, catalogNumber? } -> { bestRelease, allReleases, maxPrice, medianPrice }
//   POST /matrix     { image: { mimeType, data } } -> { text }
//   GET  /healthz    -> "ok"

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DISCOGS_BASE = 'https://api.discogs.com';
const DISCOGS_UA = 'VinylInvestigator/0.1 (+https://github.com/)';
// How many search results to enrich with marketplace stats. Each adds one Discogs call.
const MAX_RELEASES_TO_PRICE = 8;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = buildCorsHeaders(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (url.pathname === '/healthz') {
        return json({ ok: true }, corsHeaders);
      }
      if (url.pathname === '/identify' && request.method === 'POST') {
        const body = await request.json();
        return json(await identify(body, env), corsHeaders);
      }
      if (url.pathname === '/lookup' && request.method === 'POST') {
        const body = await request.json();
        return json(await lookup(body, env), corsHeaders);
      }
      if (url.pathname === '/matrix' && request.method === 'POST') {
        const body = await request.json();
        return json(await matrix(body, env), corsHeaders);
      }
      return new Response('Not found', { status: 404, headers: corsHeaders });
    } catch (err) {
      console.error(err);
      return json({ error: err.message || String(err) }, corsHeaders, 500);
    }
  }
};

// --- CORS -------------------------------------------------------------------

function buildCorsHeaders(origin, env) {
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const allowAll = allowed.includes('*');
  const allowOrigin = allowAll || allowed.includes(origin) ? origin || '*' : allowed[0] || '*';
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

function json(obj, extraHeaders = {}, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders }
  });
}

// --- Gemini -----------------------------------------------------------------

async function gemini(env, prompt, image, responseSchema) {
  if (!env.GEMINI_API_KEY) throw new Error('GEMINI_API_KEY not configured on worker');
  const model = env.GEMINI_MODEL || 'gemini-2.5-flash';
  const url = `${GEMINI_BASE}/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

  const parts = [{ text: prompt }];
  if (image?.data) {
    parts.push({ inline_data: { mime_type: image.mimeType || 'image/jpeg', data: image.data } });
  }

  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.1,
      ...(responseSchema
        ? { response_mime_type: 'application/json', response_schema: responseSchema }
        : {})
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Gemini ${res.status}: ${t.slice(0, 400)}`);
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return responseSchema ? safeJsonParse(text) : text;
}

function safeJsonParse(s) {
  try { return JSON.parse(s); } catch { return {}; }
}

// --- /identify --------------------------------------------------------------

async function identify({ image }, env) {
  if (!image?.data) throw new Error('Missing image');
  const prompt =
    'Identify the album shown on this vinyl record cover. ' +
    'Return ONLY the JSON object described by the schema. ' +
    'If you cannot see a clear artist or title, leave them empty rather than guessing. ' +
    'For catalog_number, include only if printed on the cover (spine or back) and clearly legible.';

  const schema = {
    type: 'OBJECT',
    properties: {
      artist: { type: 'STRING' },
      title: { type: 'STRING' },
      catalog_number: { type: 'STRING' },
      label: { type: 'STRING' },
      confidence: { type: 'NUMBER' }
    },
    required: ['artist', 'title']
  };

  const out = await gemini(env, prompt, image, schema);
  return {
    artist: (out.artist || '').trim(),
    title: (out.title || '').trim(),
    catalog_number: (out.catalog_number || '').trim() || undefined,
    label: (out.label || '').trim() || undefined,
    confidence: typeof out.confidence === 'number' ? out.confidence : null
  };
}

// --- /matrix ----------------------------------------------------------------

async function matrix({ image }, env) {
  if (!image?.data) throw new Error('Missing image');
  const prompt =
    'This image shows the dead-wax (runout groove) area of a vinyl record. ' +
    'Transcribe ALL etched or stamped text and numbers EXACTLY as they appear, ' +
    'preserving spacing, slashes, dashes, and any special marks. ' +
    'If both A and B sides are visible, label them. Return plain text only — no commentary.';

  const text = await gemini(env, prompt, image, null);
  return { text: (text || '').trim() };
}

// --- Discogs ----------------------------------------------------------------

async function discogs(env, path, params = {}) {
  if (!env.DISCOGS_TOKEN) throw new Error('DISCOGS_TOKEN not configured on worker');
  const url = new URL(`${DISCOGS_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v));
  }
  url.searchParams.set('token', env.DISCOGS_TOKEN);

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': DISCOGS_UA, Accept: 'application/json' }
  });
  if (res.status === 429) throw new Error('Discogs rate limited — try again in a few seconds.');
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Discogs ${res.status} on ${path}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

// --- /lookup ----------------------------------------------------------------

async function lookup({ artist, title, catalogNumber }, env) {
  if (!artist || !title) throw new Error('Missing artist or title');

  // 1) Search releases on Discogs.
  const search = await discogs(env, '/database/search', {
    artist,
    release_title: title,
    type: 'release',
    format: 'Vinyl',
    catno: catalogNumber || undefined,
    per_page: 25
  });
  const results = (search.results || []).filter((r) => r.type === 'release').slice(0, MAX_RELEASES_TO_PRICE);

  if (results.length === 0) {
    return { artist, title, bestRelease: null, allReleases: [], maxPrice: 0, medianPrice: 0 };
  }

  // 2) Enrich top N with marketplace stats. Sequential to be polite to Discogs.
  const enriched = [];
  for (const r of results) {
    try {
      const stats = await discogs(env, `/marketplace/stats/${r.id}`, { curr_abbr: 'USD' });
      enriched.push({
        id: r.id,
        year: r.year || null,
        country: r.country || null,
        label: Array.isArray(r.label) ? r.label[0] : r.label || null,
        catno: r.catno || null,
        format: Array.isArray(r.format) ? r.format.join(', ') : r.format || null,
        thumb: r.thumb || null,
        lowestPrice: numberOrZero(stats?.lowest_price?.value),
        numForSale: stats?.num_for_sale ?? 0,
        median: numberOrZero(stats?.lowest_price?.value) // proxy until we add price_suggestions
      });
    } catch (e) {
      // If one fails (rate limit, network), include with zero price so caller still sees the pressing.
      enriched.push({
        id: r.id,
        year: r.year || null,
        country: r.country || null,
        label: Array.isArray(r.label) ? r.label[0] : r.label || null,
        catno: r.catno || null,
        format: Array.isArray(r.format) ? r.format.join(', ') : r.format || null,
        thumb: r.thumb || null,
        lowestPrice: 0,
        numForSale: 0,
        median: 0,
        error: e.message
      });
    }
  }

  // 3) Score pressings: highest current lowest-for-sale wins. Falls back to 0 if nothing for sale.
  const sortedByPrice = [...enriched].sort((a, b) => (b.lowestPrice || 0) - (a.lowestPrice || 0));
  const bestRelease = sortedByPrice[0] ?? null;
  const prices = enriched.map((e) => e.lowestPrice).filter((n) => n > 0);
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const medianPrice = prices.length ? median(prices) : 0;

  return {
    artist,
    title,
    bestRelease,
    allReleases: enriched,
    maxPrice,
    medianPrice
  };
}

function numberOrZero(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function median(nums) {
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
