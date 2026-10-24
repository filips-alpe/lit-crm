import { describe, expect, it } from 'vitest';
import { resolveParties } from './parties';
import type { RendererFieldValue } from '$lib/render/props';

function f(writeTo: string, value: string | null): RendererFieldValue {
  return { label: writeTo, kind: 'text', writeTo, value, raw: value };
}

describe('resolveParties', () => {
  it('uses both ends when from and to are filled', () => {
    const fields = { a: f('from', 'B. Franklin'), b: f('to', 'D. Hume') };
    expect(resolveParties(fields, 'Account')).toEqual({
      sender: { name: 'B. Franklin', external: true },
      recipient: { name: 'D. Hume', external: true },
    });
  });

  it('outgoing: the account is the sender when only to is set', () => {
    const fields = { b: f('to', 'D. Hume') };
    expect(resolveParties(fields, 'B. Franklin')).toEqual({
      sender: { name: 'B. Franklin', external: false },
      recipient: { name: 'D. Hume', external: true },
    });
  });

  it('incoming: the account is the recipient when only from is set', () => {
    const fields = { a: f('from', 'D. Hume') };
    expect(resolveParties(fields, 'B. Franklin')).toEqual({
      sender: { name: 'D. Hume', external: true },
      recipient: { name: 'B. Franklin', external: false },
    });
  });

  it('falls back gracefully when nothing is set', () => {
    expect(resolveParties({}, 'B. Franklin')).toEqual({
      sender: { name: 'B. Franklin', external: false },
      recipient: null,
    });
    expect(resolveParties({}, null)).toEqual({ sender: null, recipient: null });
  });
});
