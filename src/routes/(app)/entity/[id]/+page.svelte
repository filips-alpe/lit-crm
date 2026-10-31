<script lang="ts">
  import { resolve } from '$app/paths';
  import BestPage from '$lib/components/BestPage.svelte';
  import { bestPageSections } from '$lib/records/bestPage';
  import type { PageData } from './$types';
  import * as m from '$lib/paraglide/messages.js';

  let { data }: { data: PageData } = $props();

  const sections = $derived(bestPageSections(data.page));
</script>

<svelte:head>
  <title
    >{m.elegant_ok_seahorse_expand({
      title: data.page.title ?? m.bold_livid_crossbill_conquer(),
    })}</title
  >
</svelte:head>

<div class="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6">
  <a href={resolve('/(app)/data')} class="text-sm text-stone-500 underline hover:text-stone-800"
    >{m.flaky_lofty_carp_cure()}</a
  >
  <div class="mt-3 rounded border border-stone-200 bg-white p-4 sm:p-6">
    <BestPage recordId={data.page.id} title={data.page.title} type={data.page.type} {sections} />
  </div>
</div>
