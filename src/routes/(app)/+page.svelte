<script lang="ts">
  import PageTitle from '$lib/components/PageTitle.svelte';
  import { dashboardFor } from '$lib/dashboards/registry';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const Dashboard = $derived(dashboardFor(data.dashboard.user.username));
</script>

<PageTitle />
<Dashboard user={data.dashboard.user} data={data.dashboard.data} />
