<script lang="ts">
  import { untrack } from 'svelte';
  import {
    closedLabel,
    draftOf,
    exitRefusal,
    handedInLabel,
    submissionOf,
    ALLES_KLAR,
    type ExitTicket,
    type ExitTicketState,
  } from './exitTicket';
  import { formatTime } from './format';
  import type { Lesson } from './lessons';
  import { handIn } from './supabase';

  let {
    lesson,
    teacherName,
    ticket,
    exit,
    onhandin,
  }: {
    lesson: Lesson;
    teacherName: string | null;
    ticket: ExitTicket | undefined;
    exit: Exclude<ExitTicketState, { kind: 'not-open' }>;
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
          <p class="handed-in" role="status">
            {handedInLabel(exit.handedInAt)} · du kannst bis {formatTime(exit.closesAt)} ändern
          </p>
        {:else}
          <p class="muted">Offen bis {formatTime(exit.closesAt)}</p>
        {/if}
      </div>
    </form>
  {:else}
    <p class="note" role="status">{closedLabel(exit.closedAt, exit.handedInAt)}</p>
    {#if exit.handedInAt && ticket}
      <dl class="answers">
        <dt>Was haben wir gemacht?</dt>
        <dd>{ticket.note || '–'}</dd>
        <dt>Was war unklar?</dt>
        <dd>{ticket.unclear}</dd>
        {#each Object.entries(ticket.ratings) as [goal, n] (goal)}
          <dt>{goal}</dt>
          <dd>{n} von 4</dd>
        {/each}
      </dl>
    {/if}
  {/if}
</section>

<style>
  .text-input {
    font: inherit;
    font-weight: 600;
    padding: var(--s-2) var(--s-3);
    resize: vertical;
  }

  .text-input[disabled] {
    color: var(--ink-3);
    border-color: var(--ink-3);
    box-shadow: none;
  }

  .choice {
    display: inline-flex;
    align-items: center;
    gap: var(--s-2);
    min-height: var(--tap);
    font-weight: 700;
    cursor: pointer;
  }

  .choice input {
    width: 20px;
    height: 20px;
    accent-color: var(--ink);
  }

  .rating {
    border: 0;
    padding: 0;
    margin: var(--s-2) 0 0;
    display: grid;
    gap: var(--s-2);
  }

  .rating legend {
    font-weight: 700;
    padding: 0;
    margin-bottom: var(--s-2);
  }

  .scale {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
  }

  .step {
    position: relative;
    cursor: pointer;
  }

  .step input {
    position: absolute;
    opacity: 0;
    inset: 0;
    margin: 0;
    cursor: pointer;
  }

  .step span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: var(--tap);
    min-height: var(--tap);
    border: var(--line);
    border-radius: var(--r-control);
    background: var(--paper);
    box-shadow: var(--shadow-sm);
    font-weight: 800;
  }

  .step input:checked + span {
    background: var(--ink);
    color: var(--paper);
  }

  .step input:focus-visible + span {
    outline: var(--focus);
    outline-offset: 2px;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-3) var(--s-4);
  }

  .handed-in {
    font-weight: 700;
  }

  .answers {
    display: grid;
    gap: var(--s-1);
    margin-top: var(--s-4);
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
