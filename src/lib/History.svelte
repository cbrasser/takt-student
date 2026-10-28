<script lang="ts">
  import { formatWhen } from './format';
  import { attendanceLabel, exportName, historyMarkdown, ticketLabel, type HistoryEntry } from './history';
  import { handedInLabel } from './exitTicket';
  import { lessonKey, type Course } from './lessons';
  import Materials from './Materials.svelte';
  import { saveText } from './save';

  let { course, entries }: { course: Course; entries: HistoryEntry[] } = $props();

  let saving = $state(false);
  let problem = $state<string | null>(null);

  async function exportMarkdown() {
    saving = true;
    problem = null;
    try {
      await saveText(exportName(course), historyMarkdown(course, entries), 'text/markdown;charset=utf-8');
    } catch {
      problem = 'Speichern hat nicht geklappt.';
    } finally {
      saving = false;
    }
  }
</script>

<section class="stack" aria-labelledby="history-title">
  <header class="head">
    <p class="meta"><span>{course.name}</span></p>
    <h1 class="display" id="history-title">Verlauf</h1>
    <div class="export">
      <button class="btn" onclick={exportMarkdown} disabled={saving}>Als Markdown speichern</button>
      <span class="muted">Deine Notizen und Exit-Tickets, auch nach dem Archivieren des Kurses.</span>
    </div>
    {#if problem}<p class="form-error" role="alert">{problem}</p>{/if}
  </header>

  {#if entries.length === 0}
    <p class="lede">Noch keine vergangenen Lektionen. Der Verlauf beginnt mit der ersten Lektion in Takt.</p>
  {:else}
    <ol class="lessons">
      {#each entries as e, i (lessonKey(e.lesson))}
        {@const flag = e.handedIn ? null : ticketLabel(e.ticket, e.lesson)}
        <li>
          <article class="leaf lesson" class:missed={e.attendance === 'missed'} aria-labelledby="history-lesson-{i}">
            <p class="caption muted">{formatWhen(e.lesson.startsAt, e.lesson.endsAt)}</p>
            <h2 class="topic" id="history-lesson-{i}">{e.lesson.topic || 'Noch kein Thema'}</h2>
            <p class="marks">
              <span class="mark" class:mark-missed={e.attendance === 'missed'}>{attendanceLabel(e.attendance)}</span>
              {#if e.handedIn?.submittedAt}
                <span class="mark">{handedInLabel(e.handedIn.submittedAt)}</span>
              {:else if flag}
                <span class="mark" class:mark-missing={e.ticket === 'missing'}>{flag}</span>
              {/if}
            </p>

            {#if e.lesson.homework}
              <h3 class="group">Hausaufgaben</h3>
              <p class="text">{e.lesson.homework}</p>
            {/if}
            {#if e.lesson.materials.length > 0}
              <h3 class="group">Material</h3>
              <Materials materials={e.lesson.materials} siteUrl={course.siteUrl} />
            {/if}
            {#if e.handedIn}
              <h3 class="group">Dein Exit-Ticket</h3>
              <dl class="answers">
                <dt>Was haben wir gemacht? · nur für dich</dt>
                <dd>{e.handedIn.note || '–'}</dd>
                <dt>Was war unklar?</dt>
                <dd>{e.handedIn.unclear}</dd>
                {#each Object.entries(e.handedIn.ratings) as [goal, n] (goal)}
                  <dt>{goal}</dt>
                  <dd>{n} von 4</dd>
                {/each}
              </dl>
            {/if}
          </article>
        </li>
      {/each}
    </ol>
  {/if}
</section>

<style>
  .head {
    display: grid;
    gap: var(--s-3);
    margin-bottom: var(--s-2);
  }

  .export {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-2) var(--s-4);
  }

  .lessons {
    list-style: none;
    padding: 0;
    display: grid;
    gap: var(--s-4);
  }

  .lesson {
    display: grid;
    gap: var(--s-1);
  }

  /* A missed lesson, to catch up on: its leaf on the danger tint. */
  .lesson.missed {
    background: var(--danger-tint);
  }

  .topic {
    font-size: var(--t-xl);
    line-height: 1.1;
  }

  .marks {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
    margin-top: var(--s-2);
  }

  .mark {
    display: inline-block;
    background: var(--paper);
    border: var(--line);
    border-radius: var(--r-control);
    box-shadow: var(--shadow-sm);
    padding: var(--s-1) var(--s-3);
    font-size: var(--t-sm);
    font-weight: 700;
  }

  .mark-missed {
    background: var(--ink);
    color: var(--paper);
  }

  .mark-missing {
    border-color: var(--danger);
    box-shadow: var(--line-w) var(--line-w) 0 var(--danger);
    color: var(--danger);
  }

  .text {
    white-space: pre-line;
  }

  .group {
    font-family: var(--font-ui);
    font-size: var(--t-sm);
    letter-spacing: 0;
    border-bottom: var(--line);
    padding-bottom: var(--s-1);
    margin: var(--s-4) 0 var(--s-2);
  }

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
