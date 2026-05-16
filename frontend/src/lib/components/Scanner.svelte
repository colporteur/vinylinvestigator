<script>
  import { identifyCover, lookupDiscogs } from '$lib/api.js';
  import { threshold } from '$lib/store.js';
  import { saveScan } from '$lib/db.js';

  /** @type {(scan: any) => void} */
  export let onResult = () => {};

  let status = 'idle'; // idle | identifying | looking-up | done | error
  let error = '';

  // Manual entry fallback
  let manualArtist = '';
  let manualTitle = '';

  let fileInput;

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    error = '';
    try {
      status = 'identifying';
      const guess = await identifyCover(file);
      if (!guess.artist || !guess.title) {
        throw new Error('Could not read artist/title from the cover. Try a clearer shot or use manual entry.');
      }
      await runLookup({ artist: guess.artist, title: guess.title, catalogNumber: guess.catalog_number });
    } catch (e) {
      status = 'error';
      error = e.message || String(e);
    } finally {
      event.target.value = ''; // allow re-selecting the same file
    }
  }

  async function handleManual() {
    if (!manualArtist.trim() || !manualTitle.trim()) {
      error = 'Enter both artist and title.';
      return;
    }
    error = '';
    try {
      await runLookup({ artist: manualArtist.trim(), title: manualTitle.trim() });
      manualArtist = '';
      manualTitle = '';
    } catch (e) {
      status = 'error';
      error = e.message || String(e);
    }
  }

  async function runLookup({ artist, title, catalogNumber }) {
    status = 'looking-up';
    const result = await lookupDiscogs({ artist, title, catalogNumber });

    const max = Number(result.maxPrice ?? 0);
    const flagged = max >= $threshold;
    const scan = {
      artist: result.artist || artist,
      title: result.title || title,
      bestRelease: result.bestRelease ?? null,
      allReleases: result.allReleases ?? [],
      maxPrice: max,
      medianPrice: Number(result.medianPrice ?? 0),
      flagged,
      matrix: '',
      scannedAt: Date.now()
    };
    const id = await saveScan(scan);
    status = 'done';
    onResult({ ...scan, id });
  }
</script>

<div class="card col">
  <div class="row">
    <strong>Scan a record</strong>
    <span class="muted" style="margin-left: auto;">Threshold ${$threshold.toFixed(2)}</span>
  </div>

  <input
    bind:this={fileInput}
    type="file"
    accept="image/*"
    capture="environment"
    on:change={handlePhoto}
    style="display: none;"
  />
  <button type="button" class="primary" style="width: 100%;" on:click={() => fileInput?.click()}>
    Snap cover photo
  </button>

  <div class="muted" style="text-align: center;">— or —</div>

  <div class="col">
    <input placeholder="Artist" bind:value={manualArtist} autocomplete="off" />
    <input placeholder="Title" bind:value={manualTitle} autocomplete="off" />
    <button type="button" on:click={handleManual}>Look up</button>
  </div>

  {#if status === 'identifying'}
    <p class="muted">Reading cover…</p>
  {:else if status === 'looking-up'}
    <p class="muted">Checking Discogs…</p>
  {/if}
  {#if error}
    <p style="color: var(--accent-flag);">{error}</p>
  {/if}
</div>
