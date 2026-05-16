<script>
  import { readMatrix } from '$lib/api.js';
  import { updateScan } from '$lib/db.js';

  /** @type {{ id: number, matrix?: string }} */
  export let scan;
  export let onChange = (_) => {};

  let typed = scan.matrix || '';
  let busy = false;
  let error = '';
  let fileInput;

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
  }
</script>

<div class="card col">
  <strong>Matrix / runout</strong>
  <p class="muted" style="margin: 0;">
    Shoot a photo of the dead wax (the inner edge near the label), or type what you can read.
    Hand-reading with magnification is usually more reliable than OCR.
  </p>

  <input
    bind:this={fileInput}
    type="file"
    accept="image/*"
    capture="environment"
    on:change={handlePhoto}
    style="display: none;"
  />
  <button type="button" on:click={() => fileInput?.click()} disabled={busy}>
    {busy ? 'Reading…' : 'Shoot dead-wax photo'}
  </button>

  <textarea
    rows="3"
    placeholder="Type the matrix/runout string here…"
    bind:value={typed}
    on:blur={save}
  ></textarea>

  {#if error}
    <p style="color: var(--accent-flag);">{error}</p>
  {/if}
</div>
