<script lang="ts">
  import { kindLabel, type Assessment } from './assessments';

  /** "Prüfung" or "Abgabe" for each assessment of a lesson or a day; each opens its details page when `onopen` is given. */
  let { assessments, onopen }: { assessments: Assessment[]; onopen?: (a: Assessment) => void } = $props();
</script>

{#if assessments.length > 0}
  <span class="badges">
    {#each assessments as a (a.id)}
      {#if onopen}
        <button class="badge" class:badge-test={a.kind === 'test'} aria-label="{kindLabel(a.kind)}: {a.title}" onclick={() => onopen(a)}>
          {kindLabel(a.kind)}
        </button>
      {:else}
        <span class="badge" class:badge-test={a.kind === 'test'} title={a.title}>{kindLabel(a.kind)}</span>
      {/if}
    {/each}
  </span>
{/if}

<style>
  .badges {
    display: inline-flex;
    flex-wrap: wrap;
    gap: var(--s-2);
  }
</style>
