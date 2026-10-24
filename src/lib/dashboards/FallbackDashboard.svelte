<script lang="ts">
  import * as m from '$lib/paraglide/messages.js';
  import AvatarImage from '$lib/components/AvatarImage.svelte';
  import {
    PersonList,
    RecordList,
    SectionCard,
    StatTile,
    TypeBreakdown,
    YearBars,
  } from './widgets';
  import type { DashboardProps } from './types';

  // Generic dashboard for any user without a bespoke one (see registry.ts).
  let { user, data }: DashboardProps = $props();
</script>

<div class="mx-auto w-full max-w-5xl space-y-4 px-3 py-4 sm:px-0">
  <header class="flex items-center gap-3">
    <AvatarImage {user} class="size-12 shrink-0" />
    <div class="min-w-0">
      <h1 class="truncate text-xl font-semibold text-stone-800">
        {m.proof_yummy_crossbill_pave({ name: user.name })}
      </h1>
      {#if user.bio}<p class="text-sm text-stone-500">{user.bio}</p>{/if}
    </div>
  </header>

  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    <StatTile label={m.vexed_late_cod_pinch()} value={data.total} color={user.color} />
    <StatTile label={m.known_strong_lynx_wish()} value={data.correspondentCount} />
    <StatTile label={m.misty_fluffy_wolf_pinch()} value={data.projects.length} />
    <StatTile
      label={m.sea_home_millipede_fall()}
      value={data.range.earliest && data.range.latest
        ? `${data.range.earliest.getUTCFullYear()}–${data.range.latest.getUTCFullYear()}`
        : '—'}
    />
  </div>

  <div class="grid gap-4 md:grid-cols-2">
    <SectionCard title={m.ornate_patient_lamb_affirm()}>
      <TypeBreakdown counts={data.countsByType} empty={m.quaint_calm_warbler_rush()} />
    </SectionCard>
    <SectionCard title={m.known_strong_lynx_wish()}>
      <PersonList people={data.correspondents} empty={m.quaint_calm_warbler_rush()} />
    </SectionCard>
  </div>

  {#if data.byYear.length > 1}
    <SectionCard title={m.sea_home_millipede_fall()}>
      <YearBars data={data.byYear} />
    </SectionCard>
  {/if}

  <SectionCard title={m.sad_that_fly_sway()}>
    <RecordList records={data.recent} limit={8} empty={m.quaint_calm_warbler_rush()} />
  </SectionCard>
</div>
