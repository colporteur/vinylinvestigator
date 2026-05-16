// Cloudflare Worker: proxies vision (Gemini) and marketplace data (Discogs)
// so that secrets never reach the browser.
//
// Endpoints:
//   POST /identify   { image: { mimeType, data } } ->
//                      { artist, title, catalog_number?, label?, year?,
//                        country?, label_variant_notes?, confidence }
//
//   POST /lookup     { artist, title, catalog_number?, year?, country?,
//                      label?, label_variant_notes? } ->
//                      { artist, title, allReleases, likelyMatchId? }
//
//   POST /live       { releaseId } ->
//                      { lowestPrice, numForSale, currency }
//
//   POST /matrix     { image: { mimeType, data } } -> { text }
//   GET  /healthz    -> "ok"
//
// Pricing model: /lookup fetches /marketplace/price_suggestions for each release
// (algorithmic, condition-segmented). /live fetches /marketplace/stats on demand
// (actual current lowest-for-sale + listing count).

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const DISCOGS_BASE = 'https://api.discogs.com';
const DISCOGS_UA = 'VinylInvestigator/0.2 (+https://github.com/)';
const MAX_RELEASES_TO_PRICE = 8;

// Discogs canonical condition labels we care about, in display order.
const CONDITIONS = [
  { label: 'Mint (M)', key: 'M' },
  { label: 'Near Mint (NM or M-)', key: 'NM' },
  { label: 'Very Good Plus (VG+)', key: 'VG+' },
  { label: 'Very Good (VG)', key: 'VG' },
  { label: 'Good Plus (G+)', key: 'G+' },
  { label: 'Good (G)', key: 'G' }
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = buildCorsHeaders(origin, env);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    try {
      if (url.pathname === '/healthz') return json({ ok: true }, corsHeaders);

      if (url.pathname === '/identify' && request.method === 'POST') {
        return json(await identify(await request.json(), env), corsHeaders);
      }
      if (url.pathname === '/lookup' && request.method === 'POST') {
        return json(await lookup(await request.json(), env), corsHeaders);
      }
      if (url.pathname === '/live' && request.method === 'POST') {
        return json(await live(await request.json(), env), corsHeaders);
      }
      if (url.pathname === '/matrix' && request.method === 'POST') {
        return json(await matrix(await request.json(), env), corsHeaders);
      }
      return new Response('Not found', { status: 404, headers: corsHeaders });
    } catch (err) {
      console.error(err);
      return json({ error: err.message || String(err) }, corsHeaders, 500);
    }
  }
};

// --- CORS / JSON ------------------------------------------------------------

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
    'Identify the vinyl record shown in this image. The image may be a front cover, back cover, ' +
    'record label close-up, spine, or some mix. Extract every pressing-identifying detail you can ' +
    'clearly see. DO NOT GUESS — leave fields empty if you cannot read them confidently. ' +
    '\n\n' +
    'Field guidance:\n' +
    '- catalog_number: the alphanumeric code printed near the label edge or on the spine ' +
    '(e.g. "BSK 3010", "MS-2156"). Often the strongest pressing identifier.\n' +
    '- year: the manufacturing or release year printed on the label or jacket. ' +
    'Prefer label year over copyright year if both are visible.\n' +
    '- country: country of pressing (often printed on the label, e.g. "Made in USA", ' +
    '"Printed in West Germany").\n' +
    '- label: record label name (e.g. "Warner Bros. Records", "Blue Note").\n' +
    '- label_variant_notes: distinguishing label visual details (e.g. "white label promo", ' +
    '"red Columbia 360 Sound label", "burbank palm-trees label", "rim text says STEREO"). ' +
    'These help match to specific pressing variants on Discogs.\n' +
    '- source: "cover", "label", or "both" — what type of image you analyzed.';

  const schema = {
    type: 'OBJECT',
    properties: {
      artist: { type: 'STRING' },
      title: { type: 'STRING' },
      catalog_number: { type: 'STRING' },
      year: { type: 'STRING' },
      country: { type: 'STRING' },
      label: { type: 'STRING' },
      label_variant_notes: { type: 'STRING' },
      source: { type: 'STRING' },
      confidence: { type: 'NUMBER' }
    },
    required: ['artist', 'title']
  };

  const out = await gemini(env, prompt, image, schema);
  return {
    artist: clean(out.artist),
    title: clean(out.title),
    catalog_number: clean(out.catalog_number) || undefined,
    year: clean(out.year) || undefined,
    country: clean(out.country) || undefined,
    label: clean(out.label) || undefined,
    label_variant_notes: clean(out.label_variant_notes) || undefined,
    source: clean(out.source) || undefined,
    confidence: typeof out.confidence === 'number' ? out.confidence : null
  };
}

function clean(v) {
  return typeof v === 'string' ? v.trim() : '';
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

async function lookup(clues, env) {
  const { artist, title, catalog_number, year, country, label, label_variant_notes } = clues;
  if (!artist || !title) throw new Error('Missing artist or title');

  // 1) Search releases on Discogs. Include catno if we have one — it filters server-side.
  const search = await discogs(env, '/database/search', {
    artist,
    release_title: title,
    type: 'release',
    format: 'Vinyl',
    catno: catalog_number || undefined,
    per_page: 25
  });
  const results = (search.results || []).filter((r) => r.type === 'release').slice(0, MAX_RELEASES_TO_PRICE);

  if (results.length === 0) {
    return { artist, title, allReleases: [], likelyMatchId: null };
  }

  // 2) For each release, fetch price_suggestions (condition-segmented prices).
  const enriched = [];
  for (const r of results) {
    const base = {
      id: r.id,
      year: r.year || null,
      country: r.country || null,
      label: normalize(r.label),
      catno: r.catno || null,
      format: Array.isArray(r.format) ? r.format.join(', ') : r.format || null,
      thumb: r.thumb || null,
      prices: {}
    };
    try {
      const sug = await discogs(env, `/marketplace/price_suggestions/${r.id}`, {});
      for (const c of CONDITIONS) {
        const slot = sug[c.label];
        const v = slot?.value;
        if (Number.isFinite(Number(v))) base.prices[c.key] = Number(v);
      }
    } catch (e) {
      base.priceError = e.message;
    }
    enriched.push(base);
  }

  // 3) Score each release against the vision clues. Highest score wins,
  //    but only if it exceeds a confidence floor.
  for (const r of enriched) {
    r.matchScore = scoreMatch(r, { catalog_number, year, country, label, label_variant_notes });
  }
  enriched.sort((a, b) => b.matchScore - a.matchScore);

  const top = enriched[0];
  const runnerUp = enriched[1];
  const LIKELY_FLOOR = 40;
  const LIKELY_GAP = 15; // top must beat second by this much to be "confident"
  const isLikely =
    top &&
    top.matchScore >= LIKELY_FLOOR &&
    (!runnerUp || top.matchScore - runnerUp.matchScore >= LIKELY_GAP);

  return {
    artist,
    title,
    allReleases: enriched,
    likelyMatchId: isLikely ? top.id : null
  };
}

function normalize(label) {
  if (!label) return null;
  return Array.isArray(label) ? label[0] : label;
}

/**
 * Score how well a Discogs release matches the vision-extracted clues.
 * Catalog number is the strongest signal (effectively unique per pressing).
 * Year/country/label compound to differentiate cosmetically-similar pressings.
 */
function scoreMatch(release, clues) {
  let score = 0;

  if (clues.catalog_number && release.catno) {
    const a = normalizeCat(clues.catalog_number);
    const b = normalizeCat(release.catno);
    if (a === b) score += 50;
    else if (a && b && (a.includes(b) || b.includes(a))) score += 30;
  }

  if (clues.year && release.year) {
    const a = parseInt(clues.year, 10);
    const b = parseInt(release.year, 10);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      if (a === b) score += 20;
      else if (Math.abs(a - b) === 1) score += 10; // off-by-one tolerable
    }
  }

  if (clues.country && release.country) {
    if (clues.country.toLowerCase() === release.country.toLowerCase()) score += 15;
  }

  if (clues.label && release.label) {
    const a = clues.label.toLowerCase();
    const b = String(release.label).toLowerCase();
    if (a === b) score += 10;
    else if (a.includes(b) || b.includes(a)) score += 5;
  }

  // Variant notes are fuzzy — give a small bonus if any keyword matches the release label.
  if (clues.label_variant_notes && release.label) {
    const notes = clues.label_variant_notes.toLowerCase();
    const lab = String(release.label).toLowerCase();
    const tokens = notes.split(/[\s,]+/).filter((t) => t.length > 3);
    if (tokens.some((t) => lab.includes(t))) score += 5;
  }

  return score;
}

function normalizeCat(s) {
  return String(s || '').toUpperCase().replace(/[\s\-_./]/g, '');
}

// --- /live ------------------------------------------------------------------

async function live({ releaseId }, env) {
  if (!releaseId) throw new Error('Missing releaseId');
  const stats = await discogs(env, `/marketplace/stats/${releaseId}`, { curr_abbr: 'USD' });
  return {
    lowestPrice: Number(stats?.lowest_price?.value) || 0,
    numForSale: stats?.num_for_sale ?? 0,
    currency: stats?.lowest_price?.currency || 'USD',
    blockedFromSale: !!stats?.blocked_from_sale
  };
}
