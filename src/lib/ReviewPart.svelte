<script lang="ts">
  import { untrack } from 'svelte';
  import type { ExitTicketState } from './exitTicket';
  import { formatTime } from './format';
  import { lessonKey, type Lesson } from './lessons';
  import { emptyReview, reviewRefusal, reviewState, reviewSubmissionOf } from './review';
  import { answerReview, reviewAnswered } from './supabase';

  /** The exit ticket's anonymous part: its own form and its own button, apart from the named ticket. */
  let { lesson, exit }: { lesson: Lesson; exit: ExitTicketState } = $props();

  // Whether the student has answered, from the server and in memory only:
  // nothing on the device ties them to their answer.
  let answered = $state<boolean | undefined>(undefined);
  let draft = $state(emptyReview());
  let busy = $state(false);
  let problem = $state<string | null>(null);

  const RATINGS = [1, 2, 3, 4, 5];
  const review = $derived(reviewState(lesson, exit, answered));

  // Asked once per lesson shown, not on every re-read of the lessons, which
  // would tear down the form being typed in. A failed ask shows the form: the
  // server refuses a second answer anyway.
  const reviewedLesson = $derived(lesson.review ? lessonKey(lesson) : null);
  $effect(() => {
    if (!reviewedLesson) return;
    const shown = untrack(() => lesson);
    let live = true;
    answered = undefined;
    draft = emptyReview();
    problem = null;
    void reviewAnswered(shown).then((a) => {
      if (live) answered = a ?? false;
    });
    return () => {
      live = false;
    };
  });

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    const out = reviewSubmissionOf(draft);
    if ('problem' in out) {
      problem = out.problem;
      return;
    }
    busy = true;
    problem = null;
    const result = await answerReview(lesson, out.submission);
    busy = false;
    const refusal = 'refused' in result ? reviewRefusal(result.refused, lesson) : null;
    if (refusal) problem = refusal.problem;
    if (!refusal || refusal.answered) {
      answered = true;
      draft = emptyReview();
    }
  }
</script>

{#if review.kind !== 'none' && review.kind !== 'not-open'}
  <section class="anonym stack" aria-labelledby="review-title">
    <h3 class="group" id="review-title">Anonym</h3>
    <p class="note">Deine Lehrperson sieht nicht, wer das geschrieben hat.</p>

    {#if review.kind === 'open'}
      <form class="stack" onsubmit={submit}>
        <fieldset class="rating">
          <legend>Wie war die Lektion für dich? · 1 = gar nicht gut, 5 = sehr gut</legend>
          <div class="scale">
            {#each RATINGS as n (n)}
              <label class="step">
                <input type="radio" name="review-rating" checked={draft.rating === n} onchange={() => (draft.rating = n)} />
                <span>{n}</span>
              </label>
            {/each}
          </div>
        </fieldset>

        <label class="field">
          <span class="field-label">{review.prompts[0]} · freiwillig</span>
          <textarea class="input text-input" rows="3" bind:value={draft.answer1}></textarea>
        </label>
        <label class="field">
          <span class="field-label">{review.prompts[1]} · freiwillig</span>
          <textarea class="input text-input" rows="3" bind:value={draft.answer2}></textarea>
        </label>

        {#if problem}<p class="form-error" role="alert">{problem}</p>{/if}

        <div class="actions">
          <button class="btn btn-primary" type="submit" disabled={busy}>Anonym abgeben</button>
          <p class="muted">Nur einmal, ohne Ändern · offen bis {formatTime(review.closesAt)}</p>
        </div>
      </form>
    {:else if review.kind === 'answered'}
      {#if problem}<p class="form-error" role="alert">{problem}</p>{/if}
      <p class="handed-in" role="status">Abgegeben</p>
    {:else if review.kind === 'closed'}
      <p class="muted" role="status">Die Bewertung ist seit {formatTime(review.closedAt)} geschlossen.</p>
    {/if}
  </section>
{/if}

<style>
  .anonym {
    margin-top: var(--s-5);
  }
</style>
