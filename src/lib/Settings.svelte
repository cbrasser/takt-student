<script lang="ts">
  /** `on`: whether «Exit-Ticket ist offen» is switched on. */
  let { on, onchange }: { on: boolean; onchange: (on: boolean) => void } = $props();
</script>

<section class="stack">
  <h1 class="display">Einstellungen</h1>
  <div class="leaf settings">
    <h2 class="leaf-title">Benachrichtigungen</h2>
    <label class="choice">
      <input
        type="checkbox"
        role="switch"
        checked={on}
        onchange={(e) => onchange((e.currentTarget as HTMLInputElement).checked)}
      />
      <span>«Exit-Ticket ist offen»</span>
    </label>
    <p class="muted">Takt meldet sich einmal pro Lektion, wenn das Exit-Ticket öffnet, ausser du hast es schon abgegeben.</p>
  </div>
</section>

<style>
  .settings {
    display: grid;
    gap: var(--s-2);
  }
</style>
