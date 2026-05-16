<script>
  import { onMount } from 'svelte';
  import { view } from '$lib/store.js';
  import { listScans } from '$lib/db.js';
  import Scanner from '$lib/components/Scanner.svelte';
  import ScanCard from '$lib/components/ScanCard.svelte';
  import Settings from '$lib/components/Settings.svelte';

  let recentScans = [];

  async function refresh() {
    recentScans = await listScans();
  }

  onMount(refresh);

  function onScanResult(scan) {
    // Newest scan goes on top of the list
    recentScans = [scan, ...recentScans];
    // After a successful scan, jump to history view so the user sees the result
    $view = 'history';
  }

  function onDelete(id) {
    recentScans = recentScans.filter((s) => s.id !== id);
  }
</script>

{#if $view === 'scan'}
  <Scanner onResult={onScanResult} />

  {#if recentScans.length}
    <p class="muted">Most recent scan:</p>
    <ScanCard scan={recentScans[0]} {onDelete} />
  {/if}

{:else if $view === 'history'}
  <div class="row" style="margin-bottom: 12px;">
    <span class="muted">{recentScans.length} record{recentScans.length === 1 ? '' : 's'} in history</span>
  </div>

  {#if recentScans.length === 0}
    <div class="card">
      <p class="muted" style="margin: 0;">No scans yet. Tap "Scan" to start.</p>
    </div>
  {:else}
    {#each recentScans as scan (scan.id)}
      <ScanCard {scan} {onDelete} />
    {/each}
  {/if}

{:else if $view === 'settings'}
  <Settings />
{/if}
