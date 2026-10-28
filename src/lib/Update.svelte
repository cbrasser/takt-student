<script lang="ts">
  import { onMount } from 'svelte';
  import { check, type Update } from '@tauri-apps/plugin-updater';
  import { relaunch } from '@tauri-apps/plugin-process';

  // Mounted by main.ts in the release desktop app only. It reads the latest
  // release's manifest on start and every 6 hours and installs nothing until
  // the student agrees.
  const CHECK_MS = 6 * 60 * 60_000;

  let update = $state.raw<Update | null>(null);
  let installing = $state(false);
  let failed = $state(false);

  async function checkForUpdate() {
    if (update || installing) return;
    try {
      update = await check();
    } catch {
      // Offline, or no release yet: the next check tries again.
    }
  }

  async function install() {
    if (!update) return;
    installing = true;
    failed = false;
    try {
      await update.downloadAndInstall();
      // On Windows the installer has closed the app already.
      await relaunch();
    } catch {
      installing = false;
      failed = true;
    }
  }

  function later() {
    void update?.close();
    update = null;
    failed = false;
  }

  onMount(() => {
    void checkForUpdate();
    const timer = setInterval(checkForUpdate, CHECK_MS);
    return () => clearInterval(timer);
  });
</script>

{#if update}
  <aside class="update leaf" aria-labelledby="update-title">
    <h2 class="update-title" id="update-title">Neue Version von Takt</h2>
    <p class="muted">Version {update.version} ist da. Takt startet danach neu.</p>
    {#if failed}
      <p class="form-error" role="alert">Das Update hat nicht geklappt. Versuch es später nochmals.</p>
    {/if}
    <div class="update-actions">
      <button class="btn btn-quiet" onclick={later} disabled={installing}>Später</button>
      <button class="btn btn-primary" onclick={install} disabled={installing}>
        {installing ? 'Wird installiert …' : 'Aktualisieren'}
      </button>
    </div>
  </aside>
{/if}

<style>
  .update {
    position: fixed;
    z-index: 1;
    right: var(--gutter);
    bottom: max(var(--gutter), env(safe-area-inset-bottom));
    left: var(--gutter);
    max-width: var(--narrow-max);
    margin-left: auto;
    display: grid;
    gap: var(--s-2);
  }

  .update-title {
    font-size: var(--t-lg);
  }

  .update-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--s-2);
    margin-top: var(--s-2);
  }
</style>
