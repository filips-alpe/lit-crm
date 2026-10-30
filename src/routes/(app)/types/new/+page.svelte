<script lang="ts">
  import TypeForm from '../TypeForm.svelte';
  import type { PageData } from './$types';
  import * as m from '$lib/paraglide/messages.js';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head><title>{m.lucky_away_donkey_flip()}</title></svelte:head>

<TypeForm form={data.form} mode="create" />
