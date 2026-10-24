<script lang="ts">
  // Tiny inline trend line over a list of numbers (e.g. `byYear.map((y) => y.count)`).
  let {
    values,
    color = '#d97706',
    width = 120,
    height = 28,
    class: className,
  }: {
    values: number[];
    color?: string;
    width?: number;
    height?: number;
    class?: string;
  } = $props();

  const points = $derived.by(() => {
    if (values.length < 2) return '';
    const max = Math.max(...values);
    const min = Math.min(...values);
    const span = max - min || 1;
    return values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * width;
        const y = height - 2 - ((v - min) / span) * (height - 4);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });
</script>

{#if points}
  <svg viewBox="0 0 {width} {height}" {width} {height} class={className} aria-hidden="true">
    <polyline {points} fill="none" stroke={color} stroke-width="1.5" stroke-linejoin="round" />
  </svg>
{/if}
