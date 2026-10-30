// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces
import type { User } from '../generated/prisma/client';
import type { SessionPayload } from '$lib/server/auth/session';

declare global {
  namespace App {
    // interface Error {}
    interface Locals {
      session?: SessionPayload;
      user?: User;
    }
    // interface PageData {}
    interface PageState {
      /** Preloaded /data/[id] data for the history-driven record detail modal. */
      detail?: import('./routes/(app)/data/[id]/$types.js').PageData;
    }
    // interface Platform {}
  }
}

export {};
