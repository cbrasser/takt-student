<script lang="ts">
  import { signIn } from './supabase';

  let { accountUrl }: { accountUrl: string } = $props();

  let email = $state('');
  let password = $state('');
  let busy = $state(false);
  let error = $state<string | null>(null);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    error = await signIn(email, password);
    busy = false;
  }
</script>

<main class="page login">
  <header class="app-bar"><span class="wordmark">Takt</span></header>
  <h1 class="display">Anmelden</h1>
  <p class="lede">Mit dem Konto, das du auch für CBRATest brauchst.</p>

  <form class="leaf stack" onsubmit={submit}>
    <label class="field">
      <span class="field-label">E-Mail</span>
      <input class="input" type="email" autocomplete="username" required bind:value={email} aria-invalid={error ? 'true' : undefined} />
    </label>
    <label class="field">
      <span class="field-label">Passwort</span>
      <input class="input" type="password" autocomplete="current-password" required bind:value={password} aria-invalid={error ? 'true' : undefined} />
    </label>
    {#if error}<p class="form-error" role="alert">{error}</p>{/if}
    <button class="btn btn-primary btn-block" type="submit" disabled={busy}>Anmelden</button>
  </form>

  <p class="links">
    <a href="{accountUrl}/passwort-vergessen" target="_blank" rel="noreferrer">Passwort vergessen</a>
    <a href="{accountUrl}/registrieren" target="_blank" rel="noreferrer">Konto erstellen</a>
  </p>
</main>

<style>
  .login {
    max-width: var(--narrow-max);
  }

  .lede {
    margin: var(--s-3) 0 var(--s-5);
  }

  .links {
    display: flex;
    justify-content: space-between;
    gap: var(--s-4);
    margin-top: var(--s-5);
    font-size: var(--t-sm);
    font-weight: 700;
  }
</style>
