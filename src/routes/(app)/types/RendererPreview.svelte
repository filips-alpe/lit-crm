<script lang="ts">
  import RecordCard from '$lib/components/RecordCard.svelte';
  import RecordRow from '$lib/components/RecordRow.svelte';
  import type { FormLayout } from '$lib/forms/layout';
  import * as m from '$lib/paraglide/messages.js';

  let {
    rendererId,
    layout,
    code,
    color,
    iconSeed,
  }: {
    rendererId: string | null;
    layout: FormLayout | null;
    code: string;
    color: string;
    iconSeed: string | null;
  } = $props();

  // Neutral sample values keyed by record column, so each renderer previews
  // against something that reads like an entry rather than "Sample"/42.
  // Columns not listed here fall back to a kind-based default.
  function sampleByColumn(): Record<string, unknown> {
    return {
      title: m.plain_active_moose_pick(),
      description: m.equal_moving_parakeet_startle(),
      note: m.cute_agent_camel_explore(),
      text: m.safe_gray_jackal_buy(),
      sum: 1200,
      total: 1200,
      hours: 4,
      unit: m.main_loud_whale_foster(),
      from: m.acidic_away_midge_breathe(),
      to: m.novel_dry_cow_pop(),
      fromGeo: '51.5,-0.1',
      toGeo: '42.36,-71.06',
      references: [m.great_cozy_firefox_hope()],
      date: '1778-02-06T00:00:00.000Z',
      start: '1778-02-06T09:00:00.000Z',
      end: '1778-02-06T13:00:00.000Z',
    };
  }

  function buildSampleRow(l: FormLayout | null) {
    const samples = sampleByColumn();
    const row: Record<string, unknown> = {
      id: 'preview',
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
      creator: {
        username: 'sample',
        name: m.smug_red_gecko_grin(),
        color: color || '#7c3f00',
        avatarSeed: 'sample',
      },
      note: samples.note,
    };
    for (const f of l?.fields ?? []) {
      if (row[f.writeTo] !== undefined) continue;
      const sample = samples[f.writeTo];
      row[f.writeTo] =
        sample !== undefined
          ? sample
          : f.kind === 'number'
            ? 42
            : f.kind === 'list'
              ? [m.smug_heavy_finch_mop(), m.cool_born_dingo_feast()]
              : f.kind === 'date' || f.kind === 'datetime'
                ? new Date().toISOString()
                : f.kind === 'location'
                  ? '51.5,-0.1'
                  : f.label || m.warm_sea_millipede_splash();
    }
    return row as Record<string, unknown> & {
      id: string;
      createdAt: string;
      status: string;
      creator: { username: string; name: string; color: string; avatarSeed: string | null };
    };
  }

  const sampleRow = $derived(buildSampleRow(layout));
  const sampleType = $derived({ code: code || 'demo', color, iconSeed, layout, rendererId });
</script>

<div class="flex flex-col gap-3">
  <div class="flex flex-col gap-1">
    <span class="text-[10px] tracking-wide text-base-content/40 uppercase"
      >{m.pretty_full_bird_pat()}</span
    >
    <div class="h-28 w-48">
      <RecordCard row={sampleRow} type={sampleType} />
    </div>
  </div>
  <div class="flex flex-col gap-1">
    <span class="text-[10px] tracking-wide text-base-content/40 uppercase"
      >{m.just_solid_cow_love()}</span
    >
    <div class="overflow-hidden rounded border border-stone-200">
      <RecordRow row={sampleRow} type={sampleType} />
    </div>
  </div>
</div>
