<script lang="ts">
  import { resolve } from '$app/paths';
  import RecordDetail from '$lib/components/RecordDetail.svelte';
  import type { PageData } from './$types';
  import * as m from '$lib/paraglide/messages.js';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{m.tame_cool_larva_link({ code: data.type.code })}</title></svelte:head>

<div class="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6">
  <a href={resolve('/(app)/data')} class="text-sm text-stone-500 underline hover:text-stone-800"
    >{m.flaky_lofty_carp_cure()}</a
  >
  <div class="mt-3 rounded border border-stone-200 bg-white p-4 sm:p-6">
    <RecordDetail {...data} />
  </div>
</div>
