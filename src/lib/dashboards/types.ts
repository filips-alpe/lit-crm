import type { Component } from 'svelte';
import type { FormLayout } from '$lib/forms/layout';
import type { Point } from '$lib/maps/projection';
import type { RendererCreator, RendererProjectChip } from '$lib/render/props';

/** The signed-in user a dashboard is rendered for. */
export interface DashboardUser {
  id: string;
  username: string;
  name: string;
  bio: string | null;
  color: string;
  avatarSeed: string | null;
}

export type DashboardPerson = RendererCreator & { id: string };

export interface DashboardType {
  id: string;
  code: string;
  color: string;
  iconSeed: string | null;
  layout: FormLayout | null;
  rendererId: string | null;
}

export type DashboardProjectChip = RendererProjectChip;

/**
 * One record the user created and/or was assigned. Shaped to drop straight into
 * `<RecordRow row={r} type={r.type} />` / `<RecordCard>` (a `type` alias, not an
 * interface, so it satisfies their `Record<string, unknown>` row prop). `text` is omitted on
 * purpose (it can be book-length) — read it from the record page if needed.
 */
export type DashboardRecord = {
  id: string;
  createdAt: Date;
  status: string;
  title: string | null;
  description: string | null;
  note: string | null;
  references: string[];
  date: Date | null;
  start: Date | null;
  end: Date | null;
  sum: number | null;
  hours: number | null;
  total: number | null;
  unit: string | null;
  from: string | null;
  to: string | null;
  fromGeo: string | null;
  toGeo: string | null;
  type: DashboardType;
  creator: DashboardPerson | null;
  assignee: DashboardPerson | null;
  projects: { projectId: string; project: DashboardProjectChip }[];
  /** How the signed-in user relates to the record. */
  role: 'creator' | 'assignee' | 'both';
};

export interface TypeCount {
  typeId: string;
  code: string;
  color: string;
  iconSeed: string | null;
  count: number;
  /** Of `count`: records the user created / was assigned. A record can be both. */
  created: number;
  assigned: number;
}

export interface YearCount {
  year: number;
  count: number;
}

export interface Correspondent {
  name: string;
  /** Letters the user sent to / received from this person (matched by name). */
  sent: number;
  received: number;
  total: number;
  first: Date | null;
  last: Date | null;
}

export interface ProjectCount {
  id: string;
  code: string;
  color: string;
  count: number;
}

export interface MoneyTotal {
  typeId: string;
  code: string;
  color: string;
  unit: string | null;
  count: number;
  sum: number;
  total: number;
}

export type GeoPoint = Point;

export interface GeoRoute {
  id: string;
  title: string | null;
  from: string | null;
  to: string | null;
  fromGeo: GeoPoint | null;
  toGeo: GeoPoint | null;
  date: Date | null;
}

/** Everything a dashboard can draw from. Pure data; built by `buildDashboardData`. */
export interface DashboardData {
  /** Every ACTIVE record the user created or was assigned, newest first
   *  (by `date ?? start ?? createdAt`). `created`/`assigned` share the objects. */
  records: DashboardRecord[];
  created: DashboardRecord[];
  assigned: DashboardRecord[];
  countsByType: TypeCount[];
  /** Earliest/latest of `date ?? start` over dated records (null if none). */
  range: { earliest: Date | null; latest: Date | null };
  /** Dated records per calendar year, ascending, gaps filled with 0. */
  byYear: YearCount[];
  /** People the user exchanges letters with, most-corresponded first. */
  correspondents: Correspondent[];
  projects: ProjectCount[];
  /** Sums of `sum`/`total` per (type, unit), for types that carry money. */
  money: MoneyTotal[];
  /** Up to 10 records dated on/before `now` (undated count by createdAt). */
  recent: DashboardRecord[];
  /** Up to 10 records dated after `now`, soonest first. */
  upcoming: DashboardRecord[];
  /** Letters with at least one parseable fromGeo/toGeo. */
  geo: GeoRoute[];
}

export interface DashboardProps {
  user: DashboardUser;
  data: DashboardData;
}

export type DashboardComponent = Component<DashboardProps>;
