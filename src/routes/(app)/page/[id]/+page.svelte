<script lang="ts">
  import BestPage from '$lib/components/bestPage/BestPage.svelte';
  import type { PageData } from './$types';
  import * as m from '$lib/paraglide/messages.js';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title
    >{m.honest_tasty_gazelle_sail({
      title: data.page.record.title ?? m.large_brief_cobra_laugh(),
    })}</title
  >
</svelte:head>

<div class="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6">
  {#key data.page.record.id}
    <BestPage page={data.page} />
  {/key}
</div>
