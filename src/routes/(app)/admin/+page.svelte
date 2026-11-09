<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  import * as m from '$lib/paraglide/messages.js';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

{#if form?.error}
  <p role="alert" class="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{form.error}</p>
{:else if form?.ok}
  <p role="status" class="mb-3 rounded bg-green-50 px-3 py-2 text-sm text-green-800">
    {m.still_stale_puma_type()}
  </p>
{/if}

<div class="overflow-x-auto">
  <table class="table" id="AdminUsers">
    <thead>
      <tr>
        <th>{m.brief_simple_wren_fulfill()}</th>
        <th>{m.dizzy_lime_vole_skip()} / {m.brave_agent_horse_achieve()}</th>
      </tr>
    </thead>
    <tbody>
      {#each data.users as user (user.id)}
        <tr data-username={user.username}>
          <td>
            <div class="font-medium">{user.name}</div>
            <div class="text-xs text-stone-500">{user.username}</div>
          </td>
          <td>
            <form
              method="POST"
              action="?/save"
              use:enhance
              class="flex flex-wrap items-center gap-4"
            >
              <input type="hidden" name="id" value={user.id} />
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="isAdmin"
                  class="checkbox checkbox-sm"
                  checked={user.isAdmin}
                />
                {m.dizzy_lime_vole_skip()}
              </label>
              <select
                name="status"
                class="select w-auto select-sm"
                aria-label={m.brave_agent_horse_achieve()}
              >
                <option value="ACTIVE" selected={user.status === 'ACTIVE'}
                  >{m.sweet_full_fireant_fry()}</option
                >
                <option value="INACTIVE" selected={user.status === 'INACTIVE'}
                  >{m.tangy_proof_bison_accept()}</option
                >
              </select>
              <button type="submit" class="btn btn-sm btn-neutral"
                >{m.lime_gross_mole_radiate()}</button
              >
            </form>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
