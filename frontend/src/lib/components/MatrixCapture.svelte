<script>
  import { readMatrix } from '$lib/api.js';
  import { updateScan } from '$lib/db.js';

  /** @type {{ id: number, matrix?: string }} */
  export let scan;
  export let onChange = (_) => {};

  let typed = scan.matrix || '';
  let busy = false;
  let error = '';
  let savedFlash = false;
  let cameraInput;
  let libraryInput;

  async function handlePhoto(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    busy = true;
    error = '';
    try {
      const r = await readMatrix(file);
      typed = (typed ? typed + '\n' : '') + (r.text || '').trim();
      await save();
    } catch (e) {
      error = e.message || String(e);
    } finally {
      busy = false;
      event.target.value = '';
    }
  }

  async function save() {
    await updateScan(scan.id, { matrix: typed });
    onChange(typed);
    scan.matrix = typed;
    savedFlash = true;
    setTimeout(() => { savedFlash = false; }, 2000);
  }

  $: hasText = (typed || '').trim().length > 0;
</script>

<div class="card col">
  <strong>Matrix / runout</strong>
  <p class="muted" style="margin: 0;">
    Shoot a dead-wax photo, pick one from your library, or just type what you can read with magnification.
  </p>

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
    <button type="button" on:click={() => cameraInput?.click()} disabled={busy} style="flex: 1;">
      {busy ? 'Reading…' : 'Take photo'}
    </button>
    <button type="button" on:click={() => libraryInput?.click()} disabled={busy} style="flex: 1;">
      Pick from library
    </button>
  </div>

  <textarea
    rows="3"
    placeholder="Type the matrix/runout string here…"
    bind:value={typed}
  ></textarea>

  <button
    type="button"
    class="primary"
    on:click={save}
    disabled={!hasText}
  >
    {savedFlash ? 'Saved ✓' : 'Save matrix'}
  </button>

  {#if error}
    <p style="color: var(--accent-flag);">{error}</p>
  {/if}
</div>
