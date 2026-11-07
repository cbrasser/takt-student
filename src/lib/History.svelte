<script lang="ts">
  import AssessmentBadges from './AssessmentBadges.svelte';
  import { assessmentsOn, type Assessment } from './assessments';
  import { formatWhen } from './format';
  import { exportName, historyMarkdown } from './history';
  import { lessonKey, type Course, type Lesson } from './lessons';
  import Materials from './Materials.svelte';
  import { saveText } from './save';

  let {
    course,
    lessons,
    assessments,
    onassessment,
  }: {
    course: Course;
    /** The course's past lessons, newest first (`courseHistory`). */
    lessons: Lesson[];
    assessments: Assessment[];
    onassessment: (a: Assessment) => void;
  } = $props();

  let saving = $state(false);
  let problem = $state<string | null>(null);

  async function exportMarkdown() {
    saving = true;
    problem = null;
    try {
      await saveText(exportName(course), historyMarkdown(course, lessons), 'text/markdown;charset=utf-8');
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
      <span class="muted">Alle Lektionen, auch nach dem Archivieren des Kurses.</span>
    </div>
    {#if problem}<p class="form-error" role="alert">{problem}</p>{/if}
  </header>

  {#if lessons.length === 0}
    <p class="lede">Noch keine vergangenen Lektionen. Der Verlauf beginnt mit der ersten Lektion in Takt.</p>
  {:else}
    <ol class="lessons">
      {#each lessons as l, i (lessonKey(l))}
        <li>
          <article class="leaf lesson" aria-labelledby="history-lesson-{i}">
            <p class="caption muted">{formatWhen(l.startsAt, l.endsAt)}</p>
            <h2 class="topic" id="history-lesson-{i}">{l.topic || 'Noch kein Thema'}</h2>
            <AssessmentBadges assessments={assessmentsOn(l, assessments)} onopen={onassessment} />

            {#if l.goals.length > 0}
              <h3 class="group">Ziele</h3>
              <ul class="list">
                {#each l.goals as goal, g (g)}<li>{goal}</li>{/each}
              </ul>
            {/if}
            {#if l.homework}
              <h3 class="group">Hausaufgaben</h3>
              <p class="text">{l.homework}</p>
            {/if}
            {#if l.materials.length > 0}
              <h3 class="group">Material</h3>
              <Materials materials={l.materials} siteUrl={course.siteUrl} />
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

  .topic {
    font-size: var(--t-xl);
    line-height: 1.1;
  }

  .text {
    white-space: pre-line;
  }
</style>
