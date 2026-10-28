<script lang="ts">
  import { assessmentKey, countdown, kindLabel, type Assessment } from './assessments';
  import { formatIsoDay, formatWhen } from './format';
  import { courseKey, coursesByName, lessonKey, type Course, type Home, type Lesson } from './lessons';

  let {
    home,
    courses,
    hues,
    assessments,
    now,
    onopen,
    onupcoming,
    onhistory,
    onassessment,
  }: {
    home: Home;
    courses: Map<string, Course>;
    hues: Map<string, number>;
    /** The next ones across all courses (`nextAssessments`). */
    assessments: Assessment[];
    now: Date;
    onopen: (lesson: Lesson) => void;
    onupcoming: (course: Course) => void;
    onhistory: (course: Course) => void;
    onassessment: (a: Assessment) => void;
  } = $props();

  const byName = $derived(coursesByName([...courses.values()]));
</script>

{#snippet content(lesson: Lesson, label: string)}
  <span class="caption">{label} · {courses.get(courseKey(lesson))?.name ?? lesson.title}</span>
  <span class="topic">{lesson.topic || 'Noch kein Thema'}</span>
  <span class="when">{formatWhen(lesson.startsAt, lesson.endsAt)}</span>
{/snippet}

<!-- The current and the last lesson open; a next lesson shows only its topic. -->
{#snippet card(lesson: Lesson, label: string, opens: boolean)}
  <li data-hue={hues.get(courseKey(lesson))}>
    {#if opens}
      <button class="card-body" onclick={() => onopen(lesson)}>{@render content(lesson, label)}</button>
    {:else}
      <div class="card-body">{@render content(lesson, label)}</div>
    {/if}
  </li>
{/snippet}

<section class="stack">
  <h1 class="display">{home.current ? 'Übersicht' : 'Gerade keine Lektion'}</h1>
  <ul class="cards">
    {#if home.current}{@render card(home.current, 'Jetzt', true)}{/if}
    {#each home.next as lesson (lessonKey(lesson))}{@render card(lesson, 'Nächste Lektion', false)}{/each}
    {#if home.last}{@render card(home.last, 'Letzte Lektion', true)}{/if}
  </ul>

  {#if assessments.length > 0}
    <section class="stack group-of-cards" aria-labelledby="assessments-heading">
      <h2 class="leaf-title" id="assessments-heading">Prüfungen und Abgaben</h2>
      <ul class="cards">
        {#each assessments as a (assessmentKey(a))}
          <li data-hue={hues.get(courseKey(a))}>
            <button class="card-body" onclick={() => onassessment(a)}>
              <span class="caption">{kindLabel(a.kind)} · {courses.get(courseKey(a))?.name ?? a.courseId}</span>
              <span class="topic">{a.title || kindLabel(a.kind)}</span>
              <span class="when">{[formatIsoDay(a.date), a.deadline && countdown(a.deadline, now)].filter(Boolean).join(' · ')}</span>
            </button>
          </li>
        {/each}
      </ul>
    </section>
  {/if}

  {#if byName.length > 0}
    <section class="stack group-of-cards" aria-labelledby="courses-heading">
      <h2 class="leaf-title" id="courses-heading">Deine Kurse</h2>
      <ul class="cards">
        {#each byName as course (courseKey(course))}
          <li data-hue={hues.get(courseKey(course))}>
            <div class="card-body">
              <span class="topic">{course.name}</span>
              <span class="course-actions">
                <button class="btn" aria-label="Demnächst · {course.name}" onclick={() => onupcoming(course)}>Demnächst</button>
                <button class="btn" aria-label="Verlauf · {course.name}" onclick={() => onhistory(course)}>Verlauf</button>
              </span>
            </div>
          </li>
        {/each}
      </ul>
    </section>
  {/if}
</section>

<style>
  .group-of-cards {
    margin-top: var(--s-4);
    gap: 0;
  }

  .course-actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--s-2);
    margin-top: var(--s-2);
  }

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
    border-left: var(--strip) solid var(--hue);
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
