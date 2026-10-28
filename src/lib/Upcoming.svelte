<script lang="ts">
  import AssessmentBadges from './AssessmentBadges.svelte';
  import { assessmentKey, countdown, kindLabel, type Assessment, type Upcoming } from './assessments';
  import { formatIsoDay, formatTimes, formatWeek } from './format';
  import { lessonKey, type Course } from './lessons';

  let {
    course,
    upcoming,
    now,
    onassessment,
  }: { course: Course; upcoming: Upcoming; now: Date; onassessment: (a: Assessment) => void } = $props();
</script>

<section class="stack" aria-labelledby="upcoming-title">
  <header class="head">
    <p class="meta"><span>{course.name}</span></p>
    <h1 class="display" id="upcoming-title">Demnächst</h1>
    <p class="muted">
      {upcoming.end ? `Bis Ende Semester, ${formatIsoDay(upcoming.end)}.` : 'Alle kommenden Lektionen.'}
    </p>
  </header>

  {#if upcoming.weeks.length === 0}
    <p class="lede">{upcoming.end ? 'Bis Ende Semester ist nichts mehr geplant.' : 'Noch nichts geplant.'}</p>
  {:else}
    {#each upcoming.weeks as week (week.start)}
      <section class="leaf week" aria-labelledby="week-{week.start}">
        <h2 class="leaf-title" id="week-{week.start}">{formatWeek(week.start)}</h2>
        <ol class="days">
          {#each week.days as day (day.date)}
            <li class="day">
              <p class="caption muted">{formatIsoDay(day.date)}</p>
              <ul class="items">
                {#each day.lessons as l (lessonKey(l))}
                  <li class="lesson">
                    <span class="times">{formatTimes(l.startsAt, l.endsAt)}</span>
                    <span class="topic">{l.topic || 'Noch kein Thema'}</span>
                    <AssessmentBadges assessments={day.assessments} />
                  </li>
                {/each}
                {#each day.assessments as a (assessmentKey(a))}
                  <li>
                    <button class="assessment" onclick={() => onassessment(a)}>
                      <AssessmentBadges assessments={[a]} />
                      <span class="title">{a.title || kindLabel(a.kind)}</span>
                      {#if a.deadline}<span class="muted">{countdown(a.deadline, now)}</span>{/if}
                    </button>
                  </li>
                {/each}
              </ul>
            </li>
          {/each}
        </ol>
      </section>
    {/each}
  {/if}
</section>

<style>
  .head {
    display: grid;
    gap: var(--s-3);
    margin-bottom: var(--s-2);
  }

  .days,
  .items {
    list-style: none;
    padding: 0;
    display: grid;
    gap: var(--s-3);
  }

  .items {
    gap: var(--s-2);
    margin-top: var(--s-1);
  }

  .lesson {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: var(--s-1) var(--s-3);
  }

  .times {
    font-weight: 600;
    color: var(--ink-2);
    font-variant-numeric: tabular-nums;
  }

  .topic {
    font-weight: 800;
  }

  .assessment {
    width: 100%;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--s-2) var(--s-3);
    min-height: var(--tap);
    text-align: left;
    background: var(--hue-wash);
    color: var(--ink);
    border: var(--line);
    border-radius: var(--r-control);
    box-shadow: var(--shadow-sm);
    padding: var(--s-2) var(--s-3);
    font: inherit;
    cursor: pointer;
  }

  .assessment:hover {
    box-shadow: var(--shadow);
  }

  .title {
    font-weight: 800;
  }
</style>
