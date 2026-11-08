<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  import * as m from '$lib/paraglide/messages.js';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

{#if form?.error}
  <p role="alert" class="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
{/if}

<form
  method="POST"
  action="?/create"
  use:enhance
  class="mb-6 flex flex-wrap items-end gap-3"
  id="GroupCreate"
>
  <label class="flex flex-col gap-1 text-sm">
    {m.heroic_kind_newt_view()}
    <input name="name" class="input input-sm" required />
  </label>
  <label class="flex flex-col gap-1 text-sm">
    {m.tame_awake_trout_roar()}
    <input name="description" class="input input-sm" />
  </label>
  <button type="submit" class="btn btn-sm btn-neutral">{m.whole_true_rooster_link()}</button>
</form>

<ul class="flex flex-col gap-4" id="GroupList">
  {#each data.groups as group (group.id)}
    {@const memberIds = new Set(group.members.map((x) => x.userId))}
    <li class="rounded-box border border-base-300 p-4" data-group={group.name}>
      <form method="POST" action="?/update" use:enhance class="flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={group.id} />
        <label class="flex flex-col gap-1 text-sm">
          {m.heroic_kind_newt_view()}
          <input name="name" class="input input-sm" value={group.name} required />
        </label>
        <label class="flex flex-col gap-1 text-sm">
          {m.tame_awake_trout_roar()}
          <input name="description" class="input input-sm" value={group.description ?? ''} />
        </label>
        <button type="submit" class="btn btn-sm btn-neutral">{m.lime_gross_mole_radiate()}</button>
        <button type="submit" formaction="?/delete" class="btn text-red-700 btn-ghost btn-sm"
          >{m.few_trick_yak_grip()}</button
        >
      </form>

      <h3 class="mt-4 text-sm font-semibold">{m.vexed_mushy_reindeer_spark()}</h3>
      {#if group.members.length === 0}
        <p class="text-sm text-stone-500">{m.spry_civil_mule_empower()}</p>
      {:else}
        <ul class="mt-1 flex flex-wrap gap-2">
          {#each group.members as member (member.userId)}
            <li class="badge gap-1 badge-lg">
              {member.user.name}
              <form method="POST" action="?/removeMember" use:enhance class="inline">
                <input type="hidden" name="groupId" value={group.id} />
                <input type="hidden" name="userId" value={member.userId} />
                <button type="submit" class="text-xs underline"
                  >{m.silly_pretty_ostrich_slide()}</button
                >
              </form>
            </li>
          {/each}
        </ul>
      {/if}
      <form method="POST" action="?/addMember" use:enhance class="mt-3 flex items-center gap-2">
        <input type="hidden" name="groupId" value={group.id} />
        <select
          name="userId"
          class="select w-auto select-sm"
          aria-label={m.dry_every_parakeet_praise()}
        >
          {#each data.users.filter((u) => !memberIds.has(u.id) && u.status === 'ACTIVE') as u (u.id)}
            <option value={u.id}>{u.name}</option>
          {/each}
        </select>
        <button type="submit" class="btn btn-sm">{m.dry_every_parakeet_praise()}</button>
      </form>
    </li>
  {/each}
</ul>
