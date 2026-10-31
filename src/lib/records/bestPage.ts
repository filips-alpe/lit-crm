/** One field of the record's type layout that holds a value. */
export interface BestPageField {
  id: string;
  label: string;
  kind: string;
  value: string | string[];
}

export interface RecordRef {
  id: string;
  title: string | null;
  typeCode: string;
  /** How many mentions (or co-mentioning records) stand behind this entry. */
  count: number;
}

export interface MentionContext {
  recordId: string;
  recordTitle: string | null;
  typeCode: string;
  start: number;
  end: number;
  surface: string;
  before: string;
  after: string;
}

export interface BestPageSequence {
  position: number;
  total: number;
  prev: { id: string; title: string | null } | null;
  next: { id: string; title: string | null } | null;
}

/** Everything the best page of a record is built from. Nothing here depends on what the record is:
 *  an entity has mentions of it, a source record has entities it mentions, and the lists a record
 *  has no data for come back empty. */
export interface BestPage {
  id: string;
  title: string | null;
  type: { code: string; color: string; iconSeed: string | null };
  fields: BestPageField[];
  references: string[];
  variants: { surface: string; count: number }[];
  mentions: {
    items: MentionContext[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  sources: RecordRef[];
  related: RecordRef[];
  mentionedEntities: RecordRef[];
  sequence: BestPageSequence | null;
}

/** What the sections are built from: the repo's page data without identity and type. */
export type BestPageInput = Pick<
  BestPage,
  | 'fields'
  | 'references'
  | 'variants'
  | 'mentions'
  | 'sources'
  | 'related'
  | 'mentionedEntities'
  | 'sequence'
>;

export type BestPageSection =
  | { kind: 'fields'; fields: BestPageField[] }
  | { kind: 'references'; references: string[] }
  | { kind: 'variants'; variants: { surface: string; count: number }[] }
  | {
      kind: 'mentions';
      items: MentionContext[];
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    }
  | { kind: 'sources'; records: RecordRef[] }
  | { kind: 'related'; records: RecordRef[] }
  | { kind: 'mentioned'; records: RecordRef[] }
  | ({ kind: 'sequence' } & BestPageSequence);

/**
 * Turns a record's best-page data into the ordered list of sections to show, leaving out every
 * section it has nothing for. Pure and blind to what the record is: no record id and no type code
 * is consulted, so any record gets the same treatment from whatever data it has.
 */
export function bestPageSections(page: BestPageInput): BestPageSection[] {
  const out: BestPageSection[] = [];
  if (page.fields.length) out.push({ kind: 'fields', fields: page.fields });
  if (page.references.length) out.push({ kind: 'references', references: page.references });
  if (page.variants.length) out.push({ kind: 'variants', variants: page.variants });
  if (page.mentions.items.length) out.push({ kind: 'mentions', ...page.mentions });
  if (page.sources.length) out.push({ kind: 'sources', records: page.sources });
  if (page.related.length) out.push({ kind: 'related', records: page.related });
  if (page.mentionedEntities.length)
    out.push({ kind: 'mentioned', records: page.mentionedEntities });
  if (page.sequence && (page.sequence.prev || page.sequence.next))
    out.push({ kind: 'sequence', ...page.sequence });
  return out;
}
