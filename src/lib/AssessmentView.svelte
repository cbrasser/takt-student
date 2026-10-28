<script lang="ts">
  import { countdown, hasDetails, kindLabel, linkify, type Assessment } from './assessments';
  import { formatDay, formatIsoDay, formatTime } from './format';
  import type { Course } from './lessons';
  import Materials from './Materials.svelte';

  let {
    assessment: a,
    course,
    now,
    onupcoming,
  }: { assessment: Assessment; course: Course | undefined; now: Date; onupcoming: () => void } = $props();
</script>

<article class="stack" aria-labelledby="assessment-title">
  <header class="head">
    <p class="meta">
      <span>{course?.name ?? a.courseId}</span>
      <span>{kindLabel(a.kind)}</span>
      <span>{formatIsoDay(a.date)}</span>
    </p>
    <h1 class="display" id="assessment-title">{a.title || kindLabel(a.kind)}</h1>
    {#if a.deadline}
      <p class="deadline">
        Abgabe bis {formatDay(a.deadline)}, {formatTime(a.deadline)} · <strong>{countdown(a.deadline, now)}</strong>
      </p>
    {/if}
    {#if course}<div><button class="btn" onclick={onupcoming}>Demnächst in {course.name}</button></div>{/if}
  </header>

  {#if !hasDetails(a)}
    <p class="note">Details folgen.</p>
  {:else}
    {#if a.pages.length > 0}
      <section class="leaf">
        <h2 class="leaf-title">Stoff</h2>
        <Materials materials={a.pages} siteUrl={course?.siteUrl ?? null} />
      </section>
    {/if}
    {#if a.goals.length > 0}
      <section class="leaf">
        <h2 class="leaf-title">Ziele</h2>
        <ul class="list">
          {#each a.goals as goal, i (i)}<li>{goal}</li>{/each}
        </ul>
      </section>
    {/if}
    {#if a.practiceUrl}
      <section class="leaf">
        <h2 class="leaf-title">Zum Üben</h2>
        <Materials materials={[{ title: 'Übungsaufgaben', path: a.practiceUrl }]} siteUrl={null} />
      </section>
    {/if}
    {#if a.freeText.trim()}
      <section class="leaf">
        <h2 class="leaf-title">Hinweise</h2>
        <p class="text">
          {#each linkify(a.freeText.trim()) as part, i (i)}{#if part.url}<a href={part.url} target="_blank" rel="noreferrer"
                >{part.text}</a
              >{:else}{part.text}{/if}{/each}
        </p>
      </section>
    {/if}
  {/if}
</article>

<style>
  .head {
    display: grid;
    gap: var(--s-3);
    margin-bottom: var(--s-2);
  }

  .deadline {
    font-weight: 600;
  }

  .list {
    padding-left: 1.25em;
    display: grid;
    gap: var(--s-2);
  }

  .text {
    white-space: pre-line;
    overflow-wrap: anywhere;
  }
</style>
