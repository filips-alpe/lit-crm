import type { RendererFieldValue } from '$lib/render/props';
import { textOf } from '$lib/render/select';

/**
 * A correspondent on a letter. `external` parties come from the record's
 * from/to fields (clickable, filter the timeline); a non-external party is the
 * account holder, supplied when the letter records only one side.
 */
export interface Party {
  name: string;
  external: boolean;
}

/**
 * Resolve a letter to an explicit sender → recipient pair. When only one of
 * from/to is filled, the account holder stands in for the other end (outgoing:
 * the account sent it; incoming: the account received it).
 */
export function resolveParties(
  fields: Record<string, RendererFieldValue>,
  accountName: string | null,
): { sender: Party | null; recipient: Party | null } {
  const from = textOf(fields, 'from');
  const to = textOf(fields, 'to');
  const account: Party | null = accountName ? { name: accountName, external: false } : null;

  if (from && to) {
    return { sender: { name: from, external: true }, recipient: { name: to, external: true } };
  }
  if (to) return { sender: account, recipient: { name: to, external: true } };
  if (from) return { sender: { name: from, external: true }, recipient: account };
  return { sender: account, recipient: null };
}
