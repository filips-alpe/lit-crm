import { afterEach, describe, expect, it, vi } from 'vitest';
import { suggestIcons } from './suggestIcons';
import { TYPE_ICONS } from './typeIcons';

function mockLanguageModel(reply: string, availability = 'available') {
  const session = {
    prompt: vi.fn().mockResolvedValue(reply),
    destroy: vi.fn(),
  };
  (globalThis as unknown as { LanguageModel: unknown }).LanguageModel = {
    availability: vi.fn().mockResolvedValue(availability),
    create: vi.fn().mockResolvedValue(session),
  };
  return session;
}

afterEach(() => {
  delete (globalThis as unknown as { LanguageModel?: unknown }).LanguageModel;
});

describe('suggestIcons', () => {
  it('returns a random sample with no context or when the Prompt API is unavailable', async () => {
    for (const [context, count] of [
      [{}, 8],
      [{ typeCode: 'Invoice' }, 6],
    ] as const) {
      const picks = await suggestIcons(context, count);
      expect(picks).toHaveLength(count);
      for (const p of picks) expect(TYPE_ICONS).toContain(p);
    }
  });

  it('returns model-ranked picks when Prompt API is available', async () => {
    mockLanguageModel(JSON.stringify(['bank', 'coin', 'cashCoin', 'wallet']));
    const picks = await suggestIcons({ typeCode: 'Invoice' }, 4);
    expect(picks).toEqual(['bank', 'coin', 'cashCoin', 'wallet']);
  });

  it('strips invalid icon names from the model reply and pads with random', async () => {
    mockLanguageModel(JSON.stringify(['bank', 'not-an-icon', 'coin']));
    const picks = await suggestIcons({ typeCode: 'Invoice' }, 6);
    expect(picks).toHaveLength(6);
    expect(picks.slice(0, 2)).toEqual(['bank', 'coin']);
    expect(new Set(picks).size).toBe(6);
    for (const p of picks) expect(TYPE_ICONS).toContain(p);
  });

  it('falls back to random when the model throws', async () => {
    const session = mockLanguageModel('not json');
    const picks = await suggestIcons({ typeCode: 'Invoice' }, 5);
    expect(picks).toHaveLength(5);
    for (const p of picks) expect(TYPE_ICONS).toContain(p);
    expect(session.destroy).toHaveBeenCalled();
  });
});
