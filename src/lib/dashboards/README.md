# Per-user dashboards

`/` renders `dashboardFor(user.username)` with `{ user, data }` (`DashboardProps`).
A dashboard is a Svelte component contributed by an extension, keyed by `User.username`; any user
without one gets `FallbackDashboard.svelte`.

## Adding a dashboard

1. Create `src/extensions/<id>/dashboards/<username>/Dashboard.svelte`.
2. Export a `dashboards` record from `src/extensions/<id>/dashboards/index.ts`, keyed by username:
   `export const dashboards = { alice: AliceDashboard };`. It is discovered automatically.
   Two extensions cannot provide a dashboard for the same username.
3. Props: `let { user, data }: DashboardProps = $props();`
   (`import type { DashboardProps } from '$lib/dashboards/types'`).

Conventions:

- Strings: use paraglide (`m.<humanId>()`). Add the key to both `messages/en.json` and
  `messages/lv.json`; keys come from `humanId()` in `@inlang/sdk`.
- Data is read-only and already loaded: no fetching, no DB access. Dates are `Date`, money is a `number`.
  Dates should be shown with `formatDate` from `$lib/utils/formatDate` (UTC, app locale).
- Styling: Tailwind with stone neutrals plus an accent (or `user.color`); the app has no dark mode.

## `data` (`DashboardData`, see `types.ts`)

| field                 | meaning                                                                                                                                                                                                         |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `records`             | every ACTIVE record the user created or was assigned, newest first (`date ?? start ?? createdAt`); each has `type`, `creator`, `assignee`, `projects`, `role` (`creator`/`assignee`/`both`). `text` is omitted. |
| `created`, `assigned` | filtered views of `records` (same objects)                                                                                                                                                                      |
| `countsByType`        | `{typeId, code, color, iconSeed, count, created, assigned}[]`, biggest first                                                                                                                                    |
| `range`               | `{earliest, latest}` over dated records (`null` if none)                                                                                                                                                        |
| `byYear`              | `{year, count}[]` ascending, gaps zero-filled                                                                                                                                                                   |
| `correspondents`      | `{name, sent, received, total, first, last}[]` — letter counterparts (from/to, excluding the user), most first                                                                                                  |
| `projects`            | `{id, code, color, count}[]`                                                                                                                                                                                    |
| `money`               | `{code, unit, count, sum, total}[]` per type+unit (records with `sum`/`total`)                                                                                                                                  |
| `recent`, `upcoming`  | ≤10 records dated up to / after now                                                                                                                                                                             |
| `geo`                 | `{id, title, from, to, fromGeo, toGeo, date}[]` letters with a parsed coordinate                                                                                                                                |

Anything else: derive from `data.records` in the component (all columns are on each record).

## Widget kit (`import { … } from '$lib/dashboards/widgets'`)

`StatTile{label,value,hint?,color?}` · `SectionCard{title?,subtitle?,aside?}` + children ·
`YearBars{data: byYear}` · `Sparkline{values}` · `Timeline{items: {id,date,title,subtitle?,color?,link?}[]}` ·
`PersonList{people: correspondents, limit?, color?}` · `RouteMap{routes: geo}` ·
`RecordList{records, variant: 'row'|'card', limit?}` (uses the app's renderers, links to the record) ·
`Epigraph{text,by?,source?}` · `TypeBreakdown{counts: countsByType}`.
Every widget takes `class` and an optional `empty` string. Compose freely with Tailwind; raw
`RecordRow`/`RecordCard`/`PersonChip`/`AvatarImage` are also fine to use directly.

## Pattern

```svelte
<script lang="ts">
  import { SectionCard, StatTile, RecordList } from '$lib/dashboards/widgets';
  import type { DashboardProps } from '$lib/dashboards/types';
  import * as m from '$lib/paraglide/messages.js';
  let { user, data }: DashboardProps = $props();
</script>

<StatTile label={m.vexed_late_cod_pinch()} value={data.records.length} />
<SectionCard title={m.sad_that_fly_sway()}
  ><RecordList records={data.recent} limit={5} /></SectionCard
>
```

Aggregation lives in `aggregate.ts` (`buildDashboardData`, pure, tested without a DB).
