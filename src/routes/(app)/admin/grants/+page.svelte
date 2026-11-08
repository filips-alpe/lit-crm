<script lang="ts">
  import { enhance } from '$app/forms';
  import RecordPicker from './RecordPicker.svelte';
  import type { ActionData, PageData } from './$types';
  import * as m from '$lib/paraglide/messages.js';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let targetKind = $state<'user' | 'group'>('user');
  let scopeKind = $state<'person' | 'project' | 'type' | 'record'>('project');

  type Grant = PageData['grants'][number];
  const who = (g: Grant) => (g.user ? g.user.name : (g.group?.name ?? ''));
  const whoKind = (g: Grant) =>
    g.user ? m.clear_bright_hedgehog_pop() : m.clean_crisp_llama_treasure();
  const scopeLabel = (g: Grant) => {
    if (g.person) return `${m.bold_busy_goldfish_embrace()}: ${g.person.name}`;
    if (g.project) return `${m.stout_nimble_stork_grin()}: ${g.project.code}`;
    if (g.type) return `${m.grand_curly_mayfly_sew()}: ${g.type.code}`;
    if (g.record)
      return `${m.simple_best_ibex_roar()}: ${g.record.title ?? g.record.note ?? g.record.id}`;
    return '';
  };
</script>

{#if form?.error}
  <p role="alert" class="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
{/if}

<form
  method="POST"
  action="?/create"
  use:enhance
  id="GrantCreate"
  class="mb-6 flex flex-wrap items-end gap-4 rounded-box border border-base-300 p-4"
>
  <fieldset class="flex flex-col gap-1 text-sm">
    <legend class="mb-1">{m.watery_fancy_goldfish_grasp()}</legend>
    <select
      name="targetKind"
      class="select select-sm"
      bind:value={targetKind}
      aria-label={m.watery_fancy_goldfish_grasp()}
    >
      <option value="user">{m.clear_bright_hedgehog_pop()}</option>
      <option value="group">{m.clean_crisp_llama_treasure()}</option>
    </select>
    {#if targetKind === 'user'}
      <select
        name="target_user"
        class="select select-sm"
        aria-label={m.clear_bright_hedgehog_pop()}
      >
        <option value="">{m.full_smart_earthworm_grin()}</option>
        {#each data.choices.users as u (u.id)}<option value={u.id}>{u.name} ({u.username})</option
          >{/each}
      </select>
    {:else}
      <select
        name="target_group"
        class="select select-sm"
        aria-label={m.clean_crisp_llama_treasure()}
      >
        <option value="">{m.full_smart_earthworm_grin()}</option>
        {#each data.choices.groups as g (g.id)}<option value={g.id}>{g.name}</option>{/each}
      </select>
    {/if}
  </fieldset>

  <fieldset class="flex flex-col gap-1 text-sm">
    <legend class="mb-1">{m.fine_born_puma_list()}</legend>
    <select
      name="scopeKind"
      class="select select-sm"
      bind:value={scopeKind}
      aria-label={m.fine_born_puma_list()}
    >
      <option value="person">{m.bold_busy_goldfish_embrace()}</option>
      <option value="project">{m.stout_nimble_stork_grin()}</option>
      <option value="type">{m.grand_curly_mayfly_sew()}</option>
      <option value="record">{m.simple_best_ibex_roar()}</option>
    </select>
    {#if scopeKind === 'person'}
      <select
        name="scope_person"
        class="select select-sm"
        aria-label={m.bold_busy_goldfish_embrace()}
      >
        <option value="">{m.full_smart_earthworm_grin()}</option>
        {#each data.choices.users as u (u.id)}<option value={u.id}>{u.name} ({u.username})</option
          >{/each}
      </select>
    {:else if scopeKind === 'project'}
      <select
        name="scope_project"
        class="select select-sm"
        aria-label={m.stout_nimble_stork_grin()}
      >
        <option value="">{m.full_smart_earthworm_grin()}</option>
        {#each data.choices.projects as p (p.id)}<option value={p.id}>{p.code}</option>{/each}
      </select>
    {:else if scopeKind === 'type'}
      <select name="scope_type" class="select select-sm" aria-label={m.grand_curly_mayfly_sew()}>
        <option value="">{m.full_smart_earthworm_grin()}</option>
        {#each data.choices.types as t (t.id)}<option value={t.id}>{t.code}</option>{/each}
      </select>
    {:else}
      <RecordPicker name="scope_record" />
    {/if}
  </fieldset>

  <label class="flex flex-col gap-1 text-sm">
    {m.maroon_bald_penguin_launch()}
    <select name="level" class="select select-sm">
      <option value="READ">{m.away_level_platypus_gleam()}</option>
      <option value="WRITE">{m.maroon_candid_spider_pop()}</option>
    </select>
  </label>

  <label class="flex items-center gap-2 text-sm">
    <input type="checkbox" name="hideAmounts" class="checkbox checkbox-sm" />
    {m.zippy_close_grebe_assure()}
  </label>

  <button type="submit" class="btn btn-sm btn-neutral">{m.raw_odd_seahorse_adore()}</button>
</form>

{#if data.grants.length === 0}
  <p class="text-sm text-stone-500">{m.super_plain_skunk_aspire()}</p>
{:else}
  <div class="overflow-x-auto">
    <table class="table table-sm" id="GrantList">
      <tbody>
        {#each data.grants as g (g.id)}
          <tr data-grant={g.id}>
            <td>{whoKind(g)}: <strong>{who(g)}</strong></td>
            <td>{scopeLabel(g)}</td>
            <td colspan="2">
              <form
                method="POST"
                action="?/update"
                use:enhance
                class="flex flex-wrap items-center gap-3"
              >
                <input type="hidden" name="id" value={g.id} />
                <select
                  name="level"
                  class="select w-auto select-xs"
                  aria-label={m.maroon_bald_penguin_launch()}
                >
                  <option value="READ" selected={g.level === 'READ'}
                    >{m.away_level_platypus_gleam()}</option
                  >
                  <option value="WRITE" selected={g.level === 'WRITE'}
                    >{m.maroon_candid_spider_pop()}</option
                  >
                </select>
                <label class="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    name="hideAmounts"
                    class="checkbox checkbox-xs"
                    checked={g.hideAmounts}
                  />
                  {m.slimy_mealy_crossbill_cuddle()}
                </label>
                <button type="submit" class="btn btn-xs btn-neutral"
                  >{m.lime_gross_mole_radiate()}</button
                >
                <button
                  type="submit"
                  formaction="?/delete"
                  class="btn text-red-700 btn-ghost btn-xs">{m.few_trick_yak_grip()}</button
                >
              </form>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
