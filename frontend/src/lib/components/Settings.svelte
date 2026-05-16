<script>
  import { threshold } from '$lib/store.js';
  import { clearScans } from '$lib/db.js';

  let value = $threshold;

  function save() {
    const n = parseFloat(value);
    if (Number.isFinite(n) && n >= 0) {
      threshold.set(n);
    }
  }

  async function nuke() {
    if (!confirm('Delete ALL scan history? Cannot be undone.')) return;
    await clearScans();
    alert('Cleared.');
  }
</script>

<div class="card col">
  <strong>Settings</strong>

  <label class="col" style="gap: 4px;">
    <span class="muted">Investigate threshold (USD)</span>
    <div class="row">
      <input
        type="number"
        step="0.01"
        min="0"
        bind:value
        on:blur={save}
        on:change={save}
        style="max-width: 140px;"
      />
      <span class="muted">Records whose top pressing meets or exceeds this get flagged.</span>
    </div>
  </label>

  <hr style="border-color: var(--border); width: 100%;" />

  <button type="button" on:click={nuke} style="color: var(--accent-flag); border-color: var(--accent-flag);">
    Clear all scan history
  </button>
</div>
