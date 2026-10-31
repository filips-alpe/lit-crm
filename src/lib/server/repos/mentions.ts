import { prisma } from '$lib/prisma';
import type { MentionSpan } from '$lib/records/mentionSegments';

/** The mentions recorded in a record's text, in text order. Empty for a record with none. */
export async function listMentionsForRecord(recordId: string): Promise<MentionSpan[]> {
  return prisma.mention.findMany({
    where: { recordId },
    select: { entityId: true, start: true, end: true, surface: true },
    orderBy: [{ start: 'asc' }, { end: 'desc' }],
  });
}
