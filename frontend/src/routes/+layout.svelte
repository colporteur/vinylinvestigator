<script>
  import '../app.css';
  import { view } from '$lib/store.js';
</script>

<header style="
  position: sticky; top: 0; z-index: 5;
  background: var(--bg-elev); border-bottom: 1px solid var(--border);
  padding: env(safe-area-inset-top, 0) 0 0 0;
">
  <div style="display: flex; align-items: center; gap: 8px; padding: 10px 16px;">
    <strong style="font-size: 1.1em;">Vinyl Investigator</strong>
    <nav style="margin-left: auto; display: flex; gap: 4px;">
      <button
        on:click={() => $view = 'scan'}
        style:font-weight={$view === 'scan' ? '700' : '400'}
        style="padding: 6px 10px; min-height: 36px;"
      >Scan</button>
      <button
        on:click={() => $view = 'history'}
        style:font-weight={$view === 'history' ? '700' : '400'}
        style="padding: 6px 10px; min-height: 36px;"
      >History</button>
      <button
        on:click={() => $view = 'settings'}
        style:font-weight={$view === 'settings' ? '700' : '400'}
        style="padding: 6px 10px; min-height: 36px;"
      >⚙</button>
    </nav>
  </div>
</header>

<main style="
  max-width: 720px; margin: 0 auto;
  padding: 12px 12px calc(24px + env(safe-area-inset-bottom, 0)) 12px;
">
  <slot />
</main>
