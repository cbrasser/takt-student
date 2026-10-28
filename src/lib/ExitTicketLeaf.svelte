<script lang="ts">
  import { untrack } from 'svelte';
  import {
    closedLabel,
    draftOf,
    exitRefusal,
    openLabel,
    submissionOf,
    ALLES_KLAR,
    type ExitTicket,
    type ExitTicketState,
  } from './exitTicket';
  import type { Lesson } from './lessons';
  import ReviewPart from './ReviewPart.svelte';
  import { handIn } from './supabase';
  import TicketAnswers from './TicketAnswers.svelte';

  let {
    lesson,
    teacherName,
    ticket,
    exit,
    now,
    onhandin,
  }: {
    lesson: Lesson;
    teacherName: string | null;
    ticket: ExitTicket | undefined;
    exit: Exclude<ExitTicketState, { kind: 'not-open' }>;
    now: Date;
    onhandin: (t: ExitTicket) => void;
  } = $props();

  // The form starts from what was handed in; a re-read doesn't overwrite what
  // the student is typing.
  let draft = $state(untrack(() => draftOf(ticket, lesson.goals)));
  let busy = $state(false);
  let problem = $state<string | null>(null);

  const teacher = $derived(teacherName || 'deine Lehrperson');
  const RATINGS = [1, 2, 3, 4];

  function rate(goal: string, n: number | null) {
    const { [goal]: _, ...others } = draft.ratings;
    draft.ratings = n === null ? others : { ...others, [goal]: n };
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const out = submissionOf(draft, lesson.goals);
    if ('problem' in out) {
      problem = out.problem;
      return;
    }
    busy = true;
    problem = null;
    const result = await handIn(lesson, out.submission);
    busy = false;
    if ('ticket' in result) onhandin(result.ticket);
    else problem = exitRefusal(result.refused, lesson);
  }
</script>

<section class="leaf exit" aria-labelledby="exit-title">
  <h2 class="leaf-title" id="exit-title">Exit-Ticket</h2>

  {#if exit.kind === 'open'}
    <form class="stack" onsubmit={submit}>
      <p class="note">
        «Was war unklar?» geht mit deinem Namen an {teacher}. «Was haben wir gemacht?» siehst nur du. Wenn du anwesend
        bist, zählt das Abgeben für die mündliche Note.
      </p>

      <label class="field">
        <span class="field-label">Was haben wir gemacht? · nur für dich</span>
        <textarea class="input text-input" rows="4" bind:value={draft.note}></textarea>
      </label>

      <div class="field">
        <label class="field-label" for="exit-unclear">Was war unklar? · an {teacher}, mit deinem Namen</label>
        <textarea
          id="exit-unclear"
          class="input text-input"
          rows="3"
          bind:value={draft.unclear}
          disabled={draft.allesKlar}
          aria-invalid={problem && !draft.allesKlar ? 'true' : undefined}
        ></textarea>
        <label class="choice">
          <input type="checkbox" bind:checked={draft.allesKlar} />
          <span>{ALLES_KLAR}</span>
        </label>
      </div>

      {#if lesson.goals.length > 0}
        <div class="field">
          <span class="field-label">Wie sicher bist du bei den Zielen? · 1 = noch gar nicht, 4 = sicher, freiwillig</span>
          {#each lesson.goals as goal, i (i)}
            <fieldset class="rating">
              <legend>{goal}</legend>
              <div class="scale">
                <label class="step">
                  <input
                    type="radio"
                    name="rating-{i}"
                    aria-label="Keine Angabe"
                    checked={draft.ratings[goal] === undefined}
                    onchange={() => rate(goal, null)}
                  />
                  <span aria-hidden="true">–</span>
                </label>
                {#each RATINGS as n (n)}
                  <label class="step">
                    <input type="radio" name="rating-{i}" checked={draft.ratings[goal] === n} onchange={() => rate(goal, n)} />
                    <span>{n}</span>
                  </label>
                {/each}
              </div>
            </fieldset>
          {/each}
        </div>
      {/if}

      {#if problem}<p class="form-error" role="alert">{problem}</p>{/if}

      <div class="actions">
        <button class="btn btn-primary" type="submit" disabled={busy}>Abgeben</button>
        {#if exit.handedInAt}
          <p class="handed-in" role="status">{openLabel(exit.closesAt, exit.handedInAt)}</p>
        {:else}
          <p class="muted">{openLabel(exit.closesAt, null)}</p>
        {/if}
      </div>
    </form>
  {:else}
    <p class="note" role="status">{closedLabel(exit.closedAt, exit.handedInAt)}</p>
    {#if exit.handedInAt && ticket}
      <div class="answers"><TicketAnswers {ticket} /></div>
    {/if}
  {/if}

  <ReviewPart {lesson} {now} />
</section>

<style>
  .answers {
    margin-top: var(--s-4);
  }
</style>
