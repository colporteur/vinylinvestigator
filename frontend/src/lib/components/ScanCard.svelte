<script>
  import { ebaySoldUrl, ebayTerapeakUrl, discogsSearchUrl, discogsReleaseUrl } from '$lib/ebay.js';
  import { deleteScan } from '$lib/db.js';
  import { defaultCondition, CONDITION_OPTIONS } from '$lib/store.js';
  import { fetchLive } from '$lib/api.js';
  import MatrixCapture from './MatrixCapture.svelte';

  /** @type {any} */
  export let scan;
  export let onDelete = () => {};

  // Per-card condition, defaulting to the user's global default.
  let condition = $defaultCondition;
  let showAllPressings = false;
  let showMatrix = false;
  let liveByRelease = {}; // releaseId → { lowestPrice, numForSale, currency }
  let livePending = null;
  let liveError = '';

  // The "featured" pressing the card shows up top. Defaults to the Worker's likelyMatchId
  // when it set one; otherwise the highest-priced pressing for the selected condition;
  // user can override via the dropdown.
  let selectedReleaseId = null;

  $: releases = scan.allReleases ?? [];
  $: likely = releases.find((r) => r.id === scan.likelyMatchId) || null;

  $: {
    if (selectedReleaseId == null) {
      if (likely) {
        selectedReleaseId = likely.id;
      } else if (releases.length) {
        const top = [...releases].sort(
          (a, b) => (priceOf(b, condition) || 0) - (priceOf(a, condition) || 0)
        )[0];
        selectedReleaseId = top?.id ?? null;
      }
    }
  }

  $: selected = releases.find((r) => r.id === selectedReleaseId) || releases[0] || null;
  $: hasConfidentMatch = !!likely;

  // Range across pressings for the currently-selected condition.
  $: rangeForCondition = (() => {
    const vals = releases.map((r) => priceOf(r, condition)).filter((n) => n > 0);
    if (vals.length === 0) return null;
    return {
      min: Math.min(...vals),
      max: Math.max(...vals),
      median: median(vals),
      count: vals.length
    };
  })();

  function priceOf(release, c) {
    return Number(release?.prices?.[c] ?? 0);
  }

  function median(nums) {
    const s = [...nums].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }

  function fmt(n) {
    if (!Number.isFinite(n) || n <= 0) return '—';
    return `$${Number(n).toFixed(2)}`;
  }

  async function loadLive(releaseId) {
    if (!releaseId) return;
    livePending = releaseId;
    liveError = '';
    try {
      const data = await fetchLive(releaseId);
      liveByRelease = { ...liveByRelease, [releaseId]: data };
    } catch (e) {
      liveError = e.message || String(e);
    } finally {
      livePending = null;
    }
  }

  async function remove() {
    if (!confirm('Delete this scan from history?')) return;
    await deleteScan(scan.id);
    onDelete(scan.id);
  }
</script>

<div class="card col">
  <!-- Header: title + delete -->
  <div class="row" style="justify-content: space-between; align-items: flex-start;">
    <div class="col" style="gap: 2px;">
      <strong>{scan.artist} — {scan.title}</strong>
      {#if scan.clues?.catalog_number || scan.clues?.year || scan.clues?.country}
        <span class="muted" style="font-size: 0.85em;">
          Read from image:
          {[scan.clues?.year, scan.clues?.country, scan.clues?.catalog_number].filter(Boolean).join(' · ')}
        </span>
      {/if}
    </div>
    <button type="button" on:click={remove} style="background: transparent; border: none; color: var(--fg-muted); padding: 4px;" aria-label="Delete">
      ✕
    </button>
  </div>

  <!-- Condition selector -->
  <div class="row" style="gap: 4px; flex-wrap: wrap;">
    <span class="muted" style="font-size: 0.85em; margin-right: 4px;">Condition:</span>
    {#each CONDITION_OPTIONS as c}
      <button
        type="button"
        on:click={() => condition = c}
        class:primary={condition === c}
        style="padding: 4px 10px; min-height: 32px; font-size: 0.85em;"
      >{c}</button>
    {/each}
  </div>

  <!-- Range across all pressings -->
  {#if rangeForCondition}
    <div class="row" style="gap: 12px; flex-wrap: wrap; font-size: 0.95em;">
      <span><strong>{condition} range:</strong> {fmt(rangeForCondition.min)} – {fmt(rangeForCondition.max)}</span>
      <span class="muted">Median {fmt(rangeForCondition.median)}</span>
      <span class="muted">{rangeForCondition.count} of {releases.length} pressings priced</span>
    </div>
  {:else if releases.length}
    <p class="muted" style="margin: 0;">No {condition} price data — try a different condition.</p>
  {:else}
    <p class="muted" style="margin: 0;">No matching pressings found on Discogs.</p>
  {/if}

  <!-- Featured pressing -->
  {#if selected}
    <div style="background: var(--bg-elev-2); border-radius: 8px; padding: 12px;">
      <div class="row" style="justify-content: space-between; gap: 8px;">
        <div class="col" style="gap: 2px;">
          <strong style="font-size: 0.95em;">
            {hasConfidentMatch && selected.id === likely?.id ? '★ Likely your copy' : 'Selected pressing'}
          </strong>
          <span style="font-size: 0.9em;">
            {selected.year || '?'} · {selected.country || '?'} · {selected.label || '?'}
            {selected.catno ? `· ${selected.catno}` : ''}
          </span>
        </div>
        {#if releases.length > 1}
          <select
            bind:value={selectedReleaseId}
            style="background: var(--bg-elev); color: var(--fg); border: 1px solid var(--border); border-radius: 8px; padding: 6px; font-size: 0.85em; max-width: 50%;"
          >
            {#each releases as r}
              <option value={r.id}>
                {r.year || '?'} {r.country || ''} {r.catno ? '· ' + r.catno : ''}
              </option>
            {/each}
          </select>
        {/if}
      </div>

      <!-- Per-pressing condition grid -->
      <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 8px;">
        {#each CONDITION_OPTIONS as c}
          <div style="background: var(--bg-elev); padding: 6px 8px; border-radius: 6px; border: 1px solid {condition === c ? 'var(--accent)' : 'var(--border)'};">
            <div class="muted" style="font-size: 0.75em;">{c}</div>
            <div style="font-weight: 600; font-size: 0.95em;">{fmt(priceOf(selected, c))}</div>
          </div>
        {/each}
      </div>

      <!-- Live for-sale -->
      <div class="row" style="margin-top: 10px; gap: 8px; flex-wrap: wrap; align-items: center;">
        {#if liveByRelease[selected.id]}
          {@const L = liveByRelease[selected.id]}
          <span style="font-size: 0.9em;">
            <strong>Live:</strong>
            {L.numForSale > 0
              ? `${L.numForSale} for sale · from ${fmt(L.lowestPrice)}`
              : 'None for sale right now'}
          </span>
          <button type="button" on:click={() => loadLive(selected.id)} style="padding: 4px 10px; min-height: 32px; font-size: 0.85em;">
            Refresh
          </button>
        {:else}
          <button
            type="button"
            on:click={() => loadLive(selected.id)}
            disabled={livePending === selected.id}
            style="padding: 6px 12px; min-height: 36px; font-size: 0.9em;"
          >
            {livePending === selected.id ? 'Checking…' : 'Fetch live for-sale'}
          </button>
        {/if}
      </div>
      {#if liveError}
        <p style="color: var(--accent-flag); margin: 6px 0 0; font-size: 0.85em;">{liveError}</p>
      {/if}
    </div>
  {/if}

  <!-- Deep links -->
  <div class="row" style="gap: 8px; flex-wrap: wrap;">
    <a href={ebaySoldUrl(scan.artist, scan.title)} target="_blank" rel="noopener">
      <button type="button">eBay Sold ↗</button>
    </a>
    <a href={ebayTerapeakUrl(scan.artist, scan.title)} target="_blank" rel="noopener">
      <button type="button">Terapeak ↗</button>
    </a>
    <a href={discogsSearchUrl(scan.artist, scan.title)} target="_blank" rel="noopener">
      <button type="button">Discogs ↗</button>
    </a>
    {#if selected?.id}
      <a href={discogsReleaseUrl(selected.id)} target="_blank" rel="noopener">
        <button type="button">This pressing ↗</button>
      </a>
    {/if}
  </div>

  <!-- All pressings: hidden by default when we have a confident match -->
  {#if releases.length > 1}
    <button type="button" on:click={() => showAllPressings = !showAllPressings} style="text-align: left;">
      {showAllPressings ? 'Hide' : 'Show'} all {releases.length} pressings
      {#if hasConfidentMatch && !showAllPressings} (likely match starred above){/if}
    </button>
    {#if showAllPressings}
      <div class="col" style="gap: 4px; max-height: 320px; overflow-y: auto;">
        {#each releases as r}
          <button
            type="button"
            on:click={() => selectedReleaseId = r.id}
            style="
              text-align: left; padding: 8px;
              background: {r.id === selectedReleaseId ? 'var(--bg-elev-2)' : 'transparent'};
              border: 1px solid {r.id === selectedReleaseId ? 'var(--accent)' : 'var(--border)'};
            "
          >
            <div class="row" style="justify-content: space-between;">
              <span style="font-size: 0.9em;">
                {r.id === likely?.id ? '★ ' : ''}{r.year || '?'} · {r.country || '?'} · {r.label || '?'}
                {r.catno ? `· ${r.catno}` : ''}
              </span>
              <span style="font-size: 0.9em; white-space: nowrap;">{fmt(priceOf(r, condition))}</span>
            </div>
          </button>
        {/each}
      </div>
    {/if}
  {/if}

  <!-- Matrix / runout -->
  {#if showMatrix || scan.matrix}
    <MatrixCapture {scan} onChange={(v) => scan.matrix = v} />
  {:else}
    <button type="button" on:click={() => showMatrix = true}>+ Add matrix / runout</button>
  {/if}
</div>
