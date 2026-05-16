<script>
  import { identifyCover, lookupDiscogs } from '$lib/api.js';
  import { saveScan } from '$lib/db.js';

  /** @type {(scan: any) => void} */
  export let onResult = () => {};

  let status = 'idle'; // idle | identifying | looking-up | done | error
  let error = '';

  // Manual entry fallback
  let manualArtist = '';
  let manualTitle = '';

  let cameraInput;   // input with capture="environment" — opens camera
  let libraryInput;  // input without capture — opens photo library / file picker

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    error = '';
    try {
      status = 'identifying';
      const clues = await identifyCover(file);
      if (!clues.artist || !clues.title) {
        throw new Error('Could not read artist/title from the image. Try a clearer shot or use manual entry.');
      }
      await runLookup(clues);
    } catch (e) {
      status = 'error';
      error = e.message || String(e);
    } finally {
      event.target.value = '';
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

  async function runLookup(clues) {
    status = 'looking-up';
    const result = await lookupDiscogs(clues);
    const scan = {
      artist: result.artist || clues.artist,
      title: result.title || clues.title,
      clues,
      allReleases: result.allReleases ?? [],
      likelyMatchId: result.likelyMatchId ?? null,
      matrix: '',
      scannedAt: Date.now()
    };
    const id = await saveScan(scan);
    status = 'done';
    onResult({ ...scan, id });
  }
</script>

<div class="card col">
  <strong>Scan a record</strong>

  <input
    bind:this={cameraInput}
    type="file"
    accept="image/*"
    capture="environment"
    on:change={handlePhoto}
    style="display: none;"
  />
  <input
    bind:this={libraryInput}
    type="file"
    accept="image/*"
    on:change={handlePhoto}
    style="display: none;"
  />

  <div class="row" style="gap: 8px;">
    <button type="button" class="primary" on:click={() => cameraInput?.click()} style="flex: 1;">
      Take photo
    </button>
    <button type="button" on:click={() => libraryInput?.click()} style="flex: 1;">
      Pick from library
    </button>
  </div>

  <p class="muted" style="margin: 4px 0;">
    Cover, back, spine, or a label close-up — all work. A label shot helps identify the exact pressing.
  </p>

  <div class="muted" style="text-align: center; margin: 4px 0;">— or —</div>

  <div class="col">
    <input placeholder="Artist" bind:value={manualArtist} autocomplete="off" />
    <input placeholder="Title" bind:value={manualTitle} autocomplete="off" />
    <button type="button" on:click={handleManual}>Look up</button>
  </div>

  {#if status === 'identifying'}
    <p class="muted">Reading image…</p>
  {:else if status === 'looking-up'}
    <p class="muted">Checking Discogs…</p>
  {/if}
  {#if error}
    <p style="color: var(--accent-flag);">{error}</p>
  {/if}
</div>
