/**
 * The types an extension author imports. Type-only, so it is safe from both client and
 * server code (a `.svelte` file may import from here; it must never import a server module).
 *
 *   import type { NavItem, RecordAction, ExtensionShell } from '$lib/extensions/types';
 *
 * Pages and endpoints are plain SvelteKit routes in the extension's `routes/` folder (see the
 * README); they use SvelteKit's own `./$types`.
 */
import type { Component, Snippet } from 'svelte';
import type { SuperValidated } from 'sveltekit-superforms';
import type { User } from '../../../generated/prisma/client';

/* ---------------------------------------------------------------- nav.ts, shell/index.ts */

/** A link in the app's navigation. See `nav.ts`. */
export interface NavItem {
  /** Unique across the app (built-in ids: `data`, `types`, `admin`). */
  id: string;
  /** Used verbatim as the link target, e.g. `/x/my-ext/list`. */
  href: string;
  /** Called at render time, so it can be a paraglide message or any localised string. */
  label: () => string;
  /** Ascending. Built-in links use 100, 200, 300; the default for an extension is 1000. */
  order?: number;
  /** Shown only to administrators. This hides the link; the route must still guard itself. */
  adminOnly?: boolean;
}

/** Props of a shell's `Layout`: it replaces the header and wraps every page behind login. */
export interface ShellLayoutProps {
  user: User;
  /** Built-in plus extension links, ordered, with `adminOnly` already applied for `user`. */
  nav: NavItem[];
  children: Snippet;
}

/** An active user listed on the login page. */
export interface LoginUser {
  id: string;
  username: string;
  name: string;
  color: string;
  avatarSeed: string | null;
}

/** The `data` of the login page (`src/routes/login/+page.server.ts`). */
export interface LoginData {
  users: LoginUser[];
  form: SuperValidated<{ username: string }>;
}

/** Props of a shell's `Login`: it replaces the login page. It posts `username` (see `$lib/schemas/login`). */
export interface ShellLoginProps {
  data: LoginData;
}

/**
 * What `src/extensions/<id>/shell/index.ts` exports as `shell`. Every slot is optional and at
 * most one extension may provide each of them (the app refuses to start otherwise).
 * Import a stylesheet from the module itself for a theme: `import './theme.css'`.
 */
export interface ExtensionShell {
  Layout?: Component<ShellLayoutProps>;
  Login?: Component<ShellLoginProps>;
  /** Where `/` redirects once signed in, e.g. `/x/my-ext/home`. Must be a path on this site. */
  home?: string;
}

/* ---------------------------------------------------------------- recordActions.ts */

/** Props every record action component receives. */
export interface RecordActionProps {
  /** The slot being rendered, e.g. `detail`. */
  placement: string;
  record: Record<string, unknown> & { id: string; status: string };
  type: { code: string; color: string; iconSeed: string | null; rendererId?: string | null };
}

/** An action an extension adds to a record, rendered wherever its `placement` is shown. */
export interface RecordAction {
  /** Unique across the app. */
  id: string;
  /** `detail` is rendered by the core record view; extensions may render their own placements. */
  placement: string;
  /** Ascending within a placement (default 0), then by id. */
  order?: number;
  component: Component<RecordActionProps>;
}
