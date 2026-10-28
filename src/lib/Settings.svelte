<script lang="ts">
  import type { NoticeSwitches, NoticeType } from './notifications';
  import { FROM_HOUR } from './reminders';

  /** `switches`: which notifications are on. */
  let { switches, onchange }: { switches: NoticeSwitches; onchange: (type: NoticeType, on: boolean) => void } = $props();

  const NOTICES: { type: NoticeType; label: string; when: string }[] = [
    { type: 'exit', label: '«Exit-Ticket ist offen»', when: 'Einmal pro Lektion, wenn das Exit-Ticket öffnet, ausser du hast es schon abgegeben.' },
    { type: 'week', label: '«Prüfung/Abgabe in 7 Tagen»', when: `Eine Woche vorher, ab ${FROM_HOUR} Uhr.` },
    { type: 'tomorrow', label: '«Prüfung/Abgabe morgen»', when: `Am Tag davor, ab ${FROM_HOUR} Uhr.` },
    { type: 'today', label: '«Abgabe heute»', when: `Am Tag der Abgabefrist, ab ${FROM_HOUR} Uhr, bis die Frist abläuft.` },
  ];
</script>

<section class="stack">
  <h1 class="display">Einstellungen</h1>
  <div class="leaf settings">
    <h2 class="leaf-title">Benachrichtigungen</h2>
    {#each NOTICES as n (n.type)}
      <div class="notice">
        <label class="choice">
          <input
            type="checkbox"
            role="switch"
            checked={switches[n.type]}
            onchange={(e) => onchange(n.type, (e.currentTarget as HTMLInputElement).checked)}
          />
          <span>{n.label}</span>
        </label>
        <p class="muted">{n.when}</p>
      </div>
    {/each}
    <p class="muted">Takt meldet sich nur, wenn die App an diesem Tag läuft.</p>
  </div>
</section>

<style>
  .settings {
    display: grid;
    gap: var(--s-3);
  }

  .notice {
    display: grid;
    gap: var(--s-1);
  }
</style>
