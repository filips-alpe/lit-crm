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

Aggregates cover **all** of the user's ACTIVE records (created or assigned) and are computed in
SQL; record lists are capped (`limits.ts`). There is no way to get "every record" — derive
what you need from the aggregates, or extend `loadDashboardData`.

| field                           | meaning                                                                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `total`                         | number of those records                                                                                                                                                                     |
| `createdCount`, `assignedCount` | of `total`: created / assigned by the user (a record can be both)                                                                                                                           |
| `records`                       | the newest 200 (`DASHBOARD_RECORDS_LIMIT`), newest first (`date ?? start ?? createdAt`); each has `type`, `creator`, `assignee`, `projects`, `role`. `text` is omitted.                     |
| `truncated`                     | `total > records.length`                                                                                                                                                                    |
| `byType`                        | `{[typeCode]: DashboardRecord[]}` — the newest 12 records of each type, newest first. Use it for per-type lists: `records` spans all types, so an old type can be absent from it.           |
| `countsByType`                  | `{typeId, code, color, iconSeed, count, created, assigned}[]`, biggest first                                                                                                                |
| `range`                         | `{earliest, latest}` of `date ?? start` over all dated records (`null` if none)                                                                                                             |
| `byYear`                        | `{year, count}[]` UTC years ascending, gaps zero-filled                                                                                                                                     |
| `correspondents`                | `{name, sent, received, total, first, last}[]` — top 100 letter counterparts (from/to, excluding the user), most first                                                                      |
| `correspondentCount`            | how many distinct correspondents exist (can exceed `correspondents.length`)                                                                                                                 |
| `projects`                      | `{id, code, color, count}[]`                                                                                                                                                                |
| `money`                         | `{code, unit, count, sum, total}[]` per type+unit (records with `sum`/`total`)                                                                                                              |
| `recent`, `upcoming`            | ≤10 records each. `recent`: dated up to now, plus undated records. `upcoming`: dated strictly after now, soonest first                                                                      |
| `geo`                           | `{id, title, from, to, fromGeo, toGeo, date}[]` — the newest 1000 records that have a `fromGeo`/`toGeo` string, minus those whose coordinates do not parse (so it can hold fewer than 1000) |

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

<StatTile label={m.vexed_late_cod_pinch()} value={data.total} />
<SectionCard title={m.sad_that_fly_sway()}
  ><RecordList records={data.recent} limit={5} /></SectionCard
>
```

Aggregation lives in SQL: `loadDashboardData` in `$lib/server/repos/dashboard` (tested against an in-memory reference in `dashboard.test.ts`). Pure helpers (`isSelf`, `foldCorrespondents`, `fillYears`) are in `aggregate.ts`.
