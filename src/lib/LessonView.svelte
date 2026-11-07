<script lang="ts">
  import AssessmentBadges from './AssessmentBadges.svelte';
  import type { Assessment } from './assessments';
  import { formatDay, formatTimes, formatWhen } from './format';
  import type { Course, Lesson } from './lessons';
  import Materials from './Materials.svelte';
  import ReviewLeaf from './ReviewLeaf.svelte';

  let {
    lesson,
    course,
    previous,
    assessments,
    now,
    onassessment,
  }: {
    lesson: Lesson;
    course: Course | undefined;
    previous: Lesson | null;
    /** Its course's Prüfungen and Abgaben on its day, as badges. */
    assessments: Assessment[];
    now: Date;
    onassessment: (a: Assessment) => void;
  } = $props();

  const siteUrl = $derived(course?.siteUrl ?? null);
</script>

<article class="stack">
  <header class="head">
    <p class="meta">
      <span>{course?.name ?? lesson.title}</span>
      <span>{formatDay(lesson.startsAt)}</span>
      <span>{formatTimes(lesson.startsAt, lesson.endsAt)}</span>
    </p>
    <h1 class="display">{lesson.topic || 'Noch kein Thema'}</h1>
    <AssessmentBadges {assessments} onopen={onassessment} />
  </header>

  <!-- The Umfrage comes first, and only while it is open. -->
  <ReviewLeaf {lesson} {now} />

  {#if lesson.goals.length > 0}
    <section class="leaf">
      <h2 class="leaf-title">Ziele</h2>
      <ul class="list">
        {#each lesson.goals as goal, i (i)}<li>{goal}</li>{/each}
      </ul>
    </section>
  {/if}

  {#if lesson.standing.length > 0}
    <section class="leaf">
      <h2 class="leaf-title">Wo wir stehen</h2>
      <ul class="list">
        {#each lesson.standing as point, i (i)}<li>{point}</li>{/each}
      </ul>
    </section>
  {/if}

  {#if lesson.homework}
    <section class="leaf">
      <h2 class="leaf-title">Hausaufgaben</h2>
      <p class="text">{lesson.homework}</p>
    </section>
  {/if}

  {#if lesson.materials.length > 0}
    <section class="leaf">
      <h2 class="leaf-title">Material</h2>
      <Materials materials={lesson.materials} {siteUrl} />
    </section>
  {/if}

  {#if previous}
    <section class="leaf previous" aria-labelledby="previous-title">
      <h2 class="leaf-title" id="previous-title">Letzte Lektion</h2>
      <p class="caption muted">{formatWhen(previous.startsAt, previous.endsAt)}</p>
      <p class="previous-topic">{previous.topic || 'Noch kein Thema'}</p>
      {#if previous.homework}
        <h3 class="group">Hausaufgaben</h3>
        <p class="text">{previous.homework}</p>
      {/if}
      {#if previous.materials.length > 0}
        <h3 class="group">Material</h3>
        <Materials materials={previous.materials} {siteUrl} />
      {/if}
    </section>
  {/if}
</article>

<style>
  .head {
    display: grid;
    gap: var(--s-3);
    margin-bottom: var(--s-2);
  }

  .list {
    padding-left: 1.25em;
    display: grid;
    gap: var(--s-2);
  }

  .text {
    white-space: pre-line;
  }

  .previous-topic {
    font-weight: 800;
    font-size: var(--t-lg);
    margin-top: var(--s-1);
  }
</style>
