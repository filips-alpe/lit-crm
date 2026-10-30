<script lang="ts">
  // One headline number with a label and optional hint, e.g. "412 / Letters".
  let {
    label,
    value,
    hint,
    color = '#b45309',
    class: className,
  }: {
    label: string;
    value: string | number;
    hint?: string;
    /** Accent for the value; defaults to amber-700. */
    color?: string;
    class?: string;
  } = $props();
</script>

<div class={['rounded-lg border border-stone-200 bg-white px-4 py-3', className]}>
  <div class="text-xs tracking-wide text-stone-500 uppercase">{label}</div>
  <div class="mt-1 text-3xl font-semibold tabular-nums" style="color: {color}">{value}</div>
  {#if hint}<div class="mt-0.5 text-xs text-stone-500">{hint}</div>{/if}
</div>
