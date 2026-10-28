<script lang="ts">
  import { checkInLabel, checkInState, refusal, type CheckIn } from './checkin';
  import type { Lesson } from './lessons';
  import { checkInTo } from './supabase';

  let {
    lesson,
    checkIn,
    now,
    oncheckin,
  }: { lesson: Lesson; checkIn: CheckIn | undefined; now: Date; oncheckin: (c: CheckIn) => void } = $props();

  const offer = $derived(checkInState(lesson, checkIn, now));
  let busy = $state(false);
  let refused = $state<string | null>(null);

  async function sayReady() {
    busy = true;
    refused = null;
    const result = await checkInTo(lesson);
    busy = false;
    if ('checkIn' in result) oncheckin(result.checkIn);
    else refused = refusal(result.refused, lesson);
  }
</script>

{#if offer.kind === 'ready'}
  <div class="check-in">
    <button class="btn btn-primary ready" disabled={busy} onclick={sayReady}>Bereit</button>
    {#if refused}<p class="form-error" role="alert">{refused}</p>{/if}
  </div>
{:else if offer.kind === 'checked-in'}
  <p class="check-in done" role="status">{checkInLabel(offer.at, offer.status)}</p>
{/if}

<style>
  .check-in {
    display: grid;
    justify-items: start;
    gap: var(--s-3);
  }

  .ready {
    padding: 0 var(--s-7);
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
