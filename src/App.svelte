<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import type { Session } from '@supabase/supabase-js';
  import { isTauri } from '@tauri-apps/api/core';
  import { openUrl } from '@tauri-apps/plugin-opener';
  import { config, loadStudentData, onSession, reviewAnswered, signOut, type StudentData } from './lib/supabase';
  import { courseHues, courseKey, home, keptOnShow, lessonKey, previousLesson, type Lesson } from './lib/lessons';
  import { refreshDue } from './lib/refresh';
  import { courseHistory } from './lib/history';
  import { assessmentKey, assessmentsOn, nextAssessments, upcoming as upcomingOf, type Assessment } from './lib/assessments';
  import { reviewNotice, reviewNotices } from './lib/reviewNotice';
  import {
    keepSeenOpen,
    keepSentReminders,
    noticeSwitches,
    notify,
    seenOpen,
    sentReminders,
    setNoticeOn,
    type NoticeType,
  } from './lib/notifications';
  import { reminderNotice, reminders } from './lib/reminders';
  import { formatTime } from './lib/format';
  import Login from './lib/Login.svelte';
  import LessonView from './lib/LessonView.svelte';
  import Overview from './lib/Overview.svelte';
  import History from './lib/History.svelte';
  import Upcoming from './lib/Upcoming.svelte';
  import AssessmentView from './lib/AssessmentView.svelte';
  import Settings from './lib/Settings.svelte';

  const CLOCK_MS = 30_000;
  /** Notifications and their settings are the desktop app's; the web app has neither. */
  const desktop = isTauri();

  /** Undefined until the stored session has been read. */
  let session = $state<Session | null | undefined>(undefined);
  let data = $state.raw<StudentData | null>(null);
  let loadedAt = $state<Date | null>(null);
  let offline = $state(false);
  let now = $state(new Date());
  let loading = false;
  /** What the student opened by hand; null follows home (the current lesson, else the overview). */
  let opened = $state<
    | { kind: 'overview' }
    | { kind: 'settings' }
    | { kind: 'lesson'; key: string }
    | { kind: 'history'; course: string }
    | { kind: 'upcoming'; course: string }
    | { kind: 'assessment'; key: string }
    | null
  >(null);
  let switches = $state(noticeSwitches());
  /**
   * For "Umfrage ist offen": by `lessonKey`, whether the student has answered
   * that Umfrage, as the server said. In memory only, like the Umfrage itself.
   */
  let answeredReviews = $state.raw(new Map<string, boolean>());
  /** The `lessonKey`s whose answer is being asked. */
  const asking = new Set<string>();

  const userId = $derived(session?.user.id ?? null);

  const lessonsNow = $derived(data ? home(data.lessons, now) : null);
  const courses = $derived(new Map((data?.courses ?? []).map((c) => [courseKey(c), c])));
  const hues = $derived(courseHues(data?.courses ?? []));
  const shown = $derived.by((): Lesson | null => {
    if (!data || (opened !== null && opened.kind !== 'lesson')) return null;
    if (opened?.kind === 'lesson') {
      const key = opened.key;
      return data.lessons.find((l) => lessonKey(l) === key) ?? null;
    }
    return lessonsNow?.current ?? null;
  });
  const historyCourse = $derived(opened?.kind === 'history' ? courses.get(opened.course) : undefined);
  const history = $derived(data && historyCourse ? courseHistory(data.lessons, historyCourse, now) : []);
  const upcomingCourse = $derived(opened?.kind === 'upcoming' ? courses.get(opened.course) : undefined);
  const upcoming = $derived(data && upcomingCourse ? upcomingOf(data.lessons, data.assessments, upcomingCourse, now) : null);
  const assessmentShown = $derived.by(() => {
    const o = opened;
    return o?.kind === 'assessment' ? data?.assessments.find((a) => assessmentKey(a) === o.key) : undefined;
  });
  const currentKey = $derived(lessonsNow?.current ? lessonKey(lessonsNow.current) : null);

  const openAssessment = (a: Assessment) => (opened = { kind: 'assessment', key: assessmentKey(a) });

  async function refresh() {
    now = new Date();
    const user = userId;
    if (!user || loading) return;
    loading = true;
    try {
      const fresh = await loadStudentData();
      // Signed out or switched while the request ran: drop it.
      if (user !== userId) return;
      data = fresh;
      loadedAt = new Date();
      offline = false;
    } catch {
      if (user === userId) offline = true;
    } finally {
      loading = false;
    }
  }

  /** The clock ticks; re-read every 15 minutes. */
  function tick() {
    now = new Date();
    if (refreshDue(loadedAt, now)) void refresh();
  }

  // A different student (or none): start over, then load.
  $effect(() => {
    void userId;
    untrack(() => {
      data = null;
      loadedAt = null;
      offline = false;
      opened = null;
      answeredReviews = new Map();
      asking.clear();
      void refresh();
    });
  });

  // A lesson's window opens: it opens by itself again. When the lesson on
  // show stops being current (it has ended, or its Umfrage has closed), it
  // stays on show until the student goes to the overview or the next lesson
  // opens.
  let wasCurrent: string | null = null;
  $effect(() => {
    const key = currentKey;
    untrack(() => {
      const kept = data ? keptOnShow(wasCurrent, key, opened === null) : null;
      opened = kept ? { kind: 'lesson', key: kept } : null;
      wasCurrent = key;
    });
  });

  // What the polling read, in the desktop app: "Umfrage ist offen" once per
  // lesson with an Umfrage the student hasn't answered (asked of the server
  // first), and the reminders of Prüfungen and Abgaben once per assessment
  // and date.
  $effect(() => {
    const d = data;
    const user = userId;
    const t = now;
    const on = switches;
    const answered = answeredReviews;
    if (!desktop || !d || !user) return;
    untrack(() => {
      const { due, ask, seen } = reviewNotices(d.lessons, answered, seenOpen(user), on.review, t);
      keepSeenOpen(user, seen);
      for (const l of due) void notify(reviewNotice(l, courses.get(courseKey(l))));
      for (const l of ask) void askAnswered(user, l);
      const remind = reminders(d.assessments, sentReminders(user), on, t);
      keepSentReminders(user, remind.sent);
      for (const r of remind.due) void notify(reminderNotice(r, courses.get(courseKey(r.assessment))));
    });
  });

  /**
   * Asks whether the student has answered the lesson's Umfrage. A failed ask
   * records nothing, so the next poll asks again and nothing fires meanwhile.
   */
  async function askAnswered(user: string, l: Lesson) {
    const key = lessonKey(l);
    if (asking.has(key)) return;
    asking.add(key);
    const answered = await reviewAnswered(l);
    // Signed out or switched while the request ran: drop it.
    if (user !== userId || !asking.delete(key) || answered === undefined) return;
    answeredReviews = new Map(answeredReviews).set(key, answered);
  }

  function switchNotice(type: NoticeType, on: boolean) {
    setNoticeOn(type, on);
    switches = { ...switches, [type]: on };
  }

  // The page takes the hue of the course on show: a lesson's, its Verlauf's, its Demnächst's or an assessment's.
  $effect(() => {
    const onShow = shown ?? historyCourse ?? upcomingCourse ?? (assessmentShown && courses.get(courseKey(assessmentShown)));
    const hue = onShow ? hues.get(courseKey(onShow)) : undefined;
    if (hue === undefined) delete document.documentElement.dataset.hue;
    else document.documentElement.dataset.hue = String(hue);
  });

  /** In the desktop app a link opens in the browser, not in the app's window. */
  function openExternally(e: MouseEvent) {
    const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
    if (!a || !desktop || a.origin === location.origin || !/^https?:$/.test(a.protocol)) return;
    e.preventDefault();
    void openUrl(a.href);
  }

  onMount(() => {
    const stop = onSession((s) => {
      // Token refreshes hand over a new object for the same student.
      if (s?.user.id !== session?.user.id || session === undefined) session = s;
    });
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const clock = setInterval(tick, CLOCK_MS);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    document.addEventListener('click', openExternally);
    return () => {
      stop();
      clearInterval(clock);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
      document.removeEventListener('click', openExternally);
    };
  });
</script>

{#if session === null}
  <Login accountUrl={config.accountUrl} />
{:else if session}
  <div class="page">
    <header class="app-bar">
      <span class="wordmark">Takt</span>
      <div class="app-bar-actions">
        {#if opened?.kind === 'settings'}
          <button class="btn" onclick={() => (opened = null)}>Zurück</button>
        {:else}
          {#if shown || historyCourse || upcomingCourse || assessmentShown}
            <button class="btn" onclick={() => (opened = { kind: 'overview' })}>Übersicht</button>
          {/if}
          {#if desktop}
            <button class="btn btn-quiet" onclick={() => (opened = { kind: 'settings' })}>Einstellungen</button>
          {/if}
        {/if}
        <button class="btn btn-quiet" onclick={signOut}>Abmelden</button>
      </div>
    </header>

    {#if offline}
      <p class="note offline" role="status">
        Keine Verbindung.{#if loadedAt} Stand {formatTime(loadedAt)}.{/if}
      </p>
    {/if}

    {#if opened?.kind === 'settings'}
      <Settings {switches} onchange={switchNotice} />
    {:else if !data || !lessonsNow}
      {#if !offline}<p class="muted">Lädt …</p>{/if}
    {:else if data.lessons.length === 0}
      <section class="stack">
        <h1 class="display">Noch keine Lektionen</h1>
        <p class="lede">Sobald deine Lehrperson Lektionen für deine Kurse plant, erscheinen sie hier.</p>
      </section>
    {:else if historyCourse}
      <History course={historyCourse} lessons={history} assessments={data.assessments} onassessment={openAssessment} />
    {:else if upcomingCourse && upcoming}
      <Upcoming course={upcomingCourse} {upcoming} {now} onassessment={openAssessment} />
    {:else if assessmentShown}
      {@const course = courses.get(courseKey(assessmentShown))}
      <AssessmentView
        assessment={assessmentShown}
        {course}
        {now}
        onupcoming={() => (opened = { kind: 'upcoming', course: courseKey(assessmentShown) })}
      />
    {:else if shown}
      {#key lessonKey(shown)}
        <LessonView
          lesson={shown}
          course={courses.get(courseKey(shown))}
          previous={previousLesson(data.lessons, shown)}
          assessments={assessmentsOn(shown, data.assessments)}
          onassessment={openAssessment}
          {now}
        />
      {/key}
    {:else}
      <Overview
        home={lessonsNow}
        {courses}
        {hues}
        assessments={nextAssessments(data.assessments, now)}
        {now}
        onopen={(l) => (opened = { kind: 'lesson', key: lessonKey(l) })}
        onupcoming={(c) => (opened = { kind: 'upcoming', course: courseKey(c) })}
        onhistory={(c) => (opened = { kind: 'history', course: courseKey(c) })}
        onassessment={openAssessment}
      />
    {/if}
  </div>
{/if}

<style>
  .offline {
    margin-bottom: var(--s-5);
  }
</style>
