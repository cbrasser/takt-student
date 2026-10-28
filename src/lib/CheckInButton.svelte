<script lang="ts">
  import { checkInLabel, checkInState, refusal, type CheckIn } from './checkin';
  import type { Lesson } from './lessons';
  import { checkIn as checkInTo } from './supabase';

  let {
    lesson,
    checkIn,
    now,
    oncheckin,
  }: { lesson: Lesson; checkIn: CheckIn | undefined; now: Date; oncheckin: (c: CheckIn) => void } = $props();

  const button = $derived(checkInState(lesson, checkIn, now));
  let busy = $state(false);
  let refused = $state<string | null>(null);

  async function ready() {
    busy = true;
    refused = null;
    const result = await checkInTo(lesson);
    busy = false;
    if ('checkIn' in result) oncheckin(result.checkIn);
    else refused = refusal(result.refused, lesson);
  }
</script>

{#if button.kind === 'ready'}
  <div class="check-in">
    <button class="btn btn-primary ready" disabled={busy} onclick={ready}>Bereit</button>
    {#if refused}<p class="form-error" role="alert">{refused}</p>{/if}
  </div>
{:else if button.kind === 'checked-in'}
  <p class="check-in done" role="status">{checkInLabel(button.checkIn)}</p>
{/if}

<style>
  .check-in {
    display: grid;
    justify-items: start;
    gap: var(--s-3);
  }

  .ready {
    min-width: 10rem;
    font-size: var(--t-md);
  }

  .done {
    display: inline-block;
    justify-self: start;
    background: var(--paper);
    border: var(--line);
    border-radius: var(--r-control);
    box-shadow: var(--shadow-sm);
    padding: var(--s-2) var(--s-4);
    font-weight: 700;
  }
</style>
