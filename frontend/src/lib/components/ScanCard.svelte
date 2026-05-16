<script>
  import { ebaySoldUrl, ebayTerapeakUrl, discogsSearchUrl, discogsReleaseUrl } from '$lib/ebay.js';
  import { deleteScan } from '$lib/db.js';
  import MatrixCapture from './MatrixCapture.svelte';

  /** @type {any} */
  export let scan;
  export let onDelete = () => {};

  let showMatrix = scan.flagged && !scan.matrix;
  let showAllPressings = false;

  function fmt(n) {
    if (!Number.isFinite(n) || n <= 0) return '—';
    return `$${Number(n).toFixed(2)}`;
  }

  async function remove() {
    if (!confirm('Delete this scan from history?')) return;
    await deleteScan(scan.id);
    onDelete(scan.id);
  }
</script>

<div class="card col">
  <div class="row" style="justify-content: space-between; align-items: flex-start;">
    <div class="col" style="gap: 2px;">
      <strong>{scan.artist} — {scan.title}</strong>
      {#if scan.bestRelease}
        <span class="muted">
          Best pressing: {scan.bestRelease.year || '?'} {scan.bestRelease.country || ''}
          {scan.bestRelease.label || ''} {scan.bestRelease.catno ? `(${scan.bestRelease.catno})` : ''}
        </span>
      {/if}
    </div>
    {#if scan.flagged}
      <span class="flag-badge">Investigate</span>
    {:else}
      <span class="good-badge">Below threshold</span>
    {/if}
  </div>

  <div class="row" style="gap: 16px; flex-wrap: wrap;">
    <span><strong>Max pressing:</strong> {fmt(scan.maxPrice)}</span>
    <span><strong>Median:</strong> {fmt(scan.medianPrice)}</span>
    {#if scan.allReleases?.length}
      <span class="muted">{scan.allReleases.length} pressings</span>
    {/if}
  </div>

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
    {#if scan.bestRelease?.id}
      <a href={discogsReleaseUrl(scan.bestRelease.id)} target="_blank" rel="noopener">
        <button type="button">Best pressing ↗</button>
      </a>
    {/if}
  </div>

  {#if scan.allReleases?.length}
    <button type="button" on:click={() => showAllPressings = !showAllPressings} style="text-align: left;">
      {showAllPressings ? 'Hide' : 'Show'} all {scan.allReleases.length} pressings
    </button>
    {#if showAllPressings}
      <div class="col" style="gap: 4px; max-height: 240px; overflow-y: auto;">
        {#each scan.allReleases as r}
          <div class="row" style="justify-content: space-between; padding: 6px 0; border-bottom: 1px solid var(--border);">
            <span style="font-size: 0.9em;">
              {r.year || '?'} · {r.country || '?'} · {r.label || '?'}
              {r.catno ? `· ${r.catno}` : ''}
            </span>
            <span style="font-size: 0.9em; white-space: nowrap;">
              {fmt(r.median)}
              <a href={discogsReleaseUrl(r.id)} target="_blank" rel="noopener" style="margin-left: 6px;">↗</a>
            </span>
          </div>
        {/each}
      </div>
    {/if}
  {/if}

  {#if scan.flagged}
    {#if showMatrix || scan.matrix}
      <MatrixCapture {scan} onChange={(v) => scan.matrix = v} />
    {:else}
      <button type="button" on:click={() => showMatrix = true}>+ Add matrix / runout</button>
    {/if}
  {/if}

  <div class="row" style="justify-content: flex-end;">
    <button type="button" on:click={remove} style="background: transparent; border: none; color: var(--fg-muted); padding: 4px;">
      Delete
    </button>
  </div>
</div>
