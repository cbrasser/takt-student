<script lang="ts">
  import { formatDay, formatTimes } from './format';
  import { courseKey, type Course, type Home, type Lesson } from './lessons';

  let {
    home,
    courses,
    hues,
    onopen,
  }: {
    home: Home;
    courses: Map<string, Course>;
    hues: Map<string, number>;
    onopen: (lesson: Lesson) => void;
  } = $props();
</script>

{#snippet card(lesson: Lesson, label: string, open: boolean)}
  {@const key = courseKey(lesson)}
  {@const body = `${formatDay(lesson.startsAt)} · ${formatTimes(lesson.startsAt, lesson.endsAt)}`}
  <li class="card" data-hue={hues.get(key)}>
    {#if open}
      <button class="card-body" onclick={() => onopen(lesson)}>
        <span class="caption">{label} · {courses.get(key)?.name ?? lesson.title}</span>
        <span class="topic">{lesson.topic || 'Noch kein Thema'}</span>
        <span class="when">{body}</span>
      </button>
    {:else}
      <div class="card-body">
        <span class="caption">{label} · {courses.get(key)?.name ?? lesson.title}</span>
        <span class="topic">{lesson.topic || 'Noch kein Thema'}</span>
        <span class="when">{body}</span>
      </div>
    {/if}
  </li>
{/snippet}

<section class="stack">
  <h1 class="display">{home.current ? 'Übersicht' : 'Gerade keine Lektion'}</h1>
  <ul class="cards">
    {#if home.current}{@render card(home.current, 'Jetzt', true)}{/if}
    {#each home.next as lesson (lesson.teacherId + lesson.id)}{@render card(lesson, 'Nächste Lektion', false)}{/each}
    {#if home.last}{@render card(home.last, 'Letzte Lektion', true)}{/if}
  </ul>
</section>

<style>
  .cards {
    list-style: none;
    padding: 0;
    display: grid;
    gap: var(--s-4);
  }

  .card-body {
    width: 100%;
    display: grid;
    gap: var(--s-1);
    text-align: left;
    background: var(--paper);
    color: var(--ink);
    border: var(--line);
    border-left: 14px solid var(--hue);
    border-radius: var(--r-leaf);
    box-shadow: var(--shadow-sm);
    padding: var(--s-4) var(--s-5);
  }

  button.card-body {
    cursor: pointer;
    transition:
      transform var(--dur-fast) var(--ease),
      box-shadow var(--dur-fast) var(--ease);
  }

  button.card-body:hover {
    box-shadow: var(--shadow);
    transform: translate(-1px, -1px);
  }

  button.card-body:active {
    transform: translate(2px, 2px);
    box-shadow: 0 0 0 var(--ink);
  }

  .topic {
    font-family: var(--font-display);
    font-weight: 800;
    font-size: var(--t-xl);
    line-height: 1.1;
  }

  .when {
    font-weight: 600;
    color: var(--ink-2);
  }
</style>
