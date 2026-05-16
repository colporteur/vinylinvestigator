<script>
  import { defaultCondition, CONDITION_OPTIONS } from '$lib/store.js';
  import { clearScans } from '$lib/db.js';

  async function nuke() {
    if (!confirm('Delete ALL scan history? Cannot be undone.')) return;
    await clearScans();
    alert('Cleared.');
  }
</script>

<div class="card col">
  <strong>Settings</strong>

  <label class="col" style="gap: 4px;">
    <span class="muted">Default condition (used until you change it on a card)</span>
    <div class="row" style="gap: 4px; flex-wrap: wrap;">
      {#each CONDITION_OPTIONS as c}
        <button
          type="button"
          on:click={() => defaultCondition.set(c)}
          class:primary={$defaultCondition === c}
          style="padding: 6px 12px; min-height: 36px;"
        >{c}</button>
      {/each}
    </div>
  </label>

  <hr style="border-color: var(--border); width: 100%;" />

  <button type="button" on:click={nuke} style="color: var(--accent-flag); border-color: var(--accent-flag);">
    Clear all scan history
  </button>
</div>
