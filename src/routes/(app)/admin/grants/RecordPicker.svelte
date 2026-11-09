<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';

  // Searches records through the same endpoint the record pickers use (so only records the
  // admin can read are offered) and posts the chosen id as `name`.
  let { name }: { name: string } = $props();

  let q = $state('');
  let options = $state<{ id: string; label: string }[]>([]);
  let picked = $state('');
  let timer: ReturnType<typeof setTimeout> | undefined;

  function search() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const res = await fetch(`/data/options?kind=record&q=${encodeURIComponent(q)}`);
      if (!res.ok) return;
      options = ((await res.json()) as { options: { id: string; label: string }[] }).options;
      if (!options.some((o) => o.id === picked)) picked = options[0]?.id ?? '';
    }, 200);
  }
</script>

<div class="flex flex-col gap-1">
  <input
    type="search"
    class="input input-sm"
    placeholder={m.game_arable_snake_push()}
    aria-label={m.game_arable_snake_push()}
    bind:value={q}
    oninput={search}
    onfocus={() => options.length === 0 && search()}
  />
  <select
    {name}
    class="select select-sm"
    bind:value={picked}
    aria-label={m.simple_best_ibex_roar()}
  >
    <option value="">{m.full_smart_earthworm_grin()}</option>
    {#each options as o (o.id)}
      <option value={o.id}>{o.label}</option>
    {/each}
  </select>
</div>
