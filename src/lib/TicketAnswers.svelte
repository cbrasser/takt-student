<script lang="ts">
  import type { ExitTicket } from './exitTicket';

  /** What the student handed in, each answer under a small label: the closed exit ticket and the Verlauf. */
  let { ticket }: { ticket: ExitTicket } = $props();
</script>

<dl class="answers">
  <dt>Was haben wir gemacht? · nur für dich</dt>
  <dd>{ticket.note || '–'}</dd>
  <dt>Was war unklar?</dt>
  <dd>{ticket.unclear}</dd>
  {#each Object.entries(ticket.ratings) as [goal, n] (goal)}
    <dt>{goal}</dt>
    <dd>{n} von 4</dd>
  {/each}
</dl>

<style>
  .answers {
    display: grid;
    gap: var(--s-1);
  }

  .answers dt {
    font-size: var(--t-xs);
    font-weight: 700;
    color: var(--ink-2);
    margin-top: var(--s-2);
  }

  .answers dd {
    margin: 0;
    white-space: pre-line;
    font-weight: 600;
  }
</style>
