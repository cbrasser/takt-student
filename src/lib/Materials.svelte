<script lang="ts">
  import { materialUrl, type MaterialRef } from './lessons';

  let { materials, siteUrl }: { materials: MaterialRef[]; siteUrl: string | null } = $props();
</script>

<ul class="materials">
  {#each materials as m (m.path)}
    {@const url = materialUrl(m.path, siteUrl)}
    <li>
      {#if url}
        <a href={url} target="_blank" rel="noreferrer">{m.title}</a>
      {:else}
        <span>{m.title}</span>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .materials {
    list-style: none;
    padding: 0;
    display: grid;
    gap: var(--s-2);
  }

  a,
  span {
    display: inline-flex;
    align-items: center;
    min-height: var(--tap);
    font-weight: 700;
  }

  a::after {
    content: "↗";
    margin-left: var(--s-2);
    text-decoration: none;
    display: inline-block;
  }
</style>
