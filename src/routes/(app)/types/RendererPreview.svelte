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

  // Domain-flavoured sample values keyed by record column, so each renderer
  // previews against something that reads like a real entry rather than
  // "Sample"/42. Columns not listed here fall back to a kind-based default.
  const SAMPLE_BY_COLUMN: Record<string, unknown> = {
    title: 'Treaty of Alliance',
    description: 'Signed at the Hôtel de Coislin, by deliberate intention.',
    note: 'A note kept in the margin.',
    text: 'The full text of the piece…',
    sum: 1200,
    total: 1200,
    hours: 4,
    unit: 'livres',
    from: 'Mrs. Silence Dogood',
    to: 'The New-England Courant',
    fromGeo: '51.5,-0.1',
    toGeo: '42.36,-71.06',
    references: ['PBF vol 1 doc 8'],
    date: '1778-02-06T00:00:00.000Z',
    start: '1778-02-06T09:00:00.000Z',
    end: '1778-02-06T13:00:00.000Z',
  };

  function buildSampleRow(l: FormLayout | null) {
    const row: Record<string, unknown> = {
      id: 'preview',
      createdAt: new Date().toISOString(),
      status: 'ACTIVE',
      creator: {
        username: 'bfranklin',
        name: 'B. Franklin',
        color: color || '#7c3f00',
        avatarSeed: 'bfranklin',
      },
      note: SAMPLE_BY_COLUMN.note,
    };
    for (const f of l?.fields ?? []) {
      if (row[f.writeTo] !== undefined) continue;
      const sample = SAMPLE_BY_COLUMN[f.writeTo];
      row[f.writeTo] =
        sample !== undefined
          ? sample
          : f.kind === 'number'
            ? 42
            : f.kind === 'list'
              ? ['Example A', 'Example B']
              : f.kind === 'date' || f.kind === 'datetime'
                ? new Date().toISOString()
                : f.kind === 'location'
                  ? '51.5,-0.1'
                  : f.label || 'Sample';
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
