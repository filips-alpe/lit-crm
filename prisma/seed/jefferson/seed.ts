import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PrismaClient } from '../../../generated/prisma/client';
import { jeffersonTypes } from './types';

const generatedDir = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'generated',
  'jefferson',
);

function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(resolve(generatedDir, name), 'utf8')) as T;
}

export interface JeffersonRecord {
  key: string;
  type: string;
  part: string;
  title: string;
  description?: string;
  text: string;
  note?: string;
  references: string[];
  date?: string;
}

export interface JeffersonEntity {
  key: string;
  type: string;
  title: string;
  note?: string;
  references: string[];
  mentionCount: number;
}

export interface JeffersonMention {
  recordKey: string;
  entityKey: string;
  start: number;
  end: number;
  surface: string;
}

/** One project per part of the corpus, plus one for the entities. Colours are distinct from each
 *  other; the Franklin project colours are not reused (checked in seed.test.ts). */
export const JEFFERSON_PROJECTS = [
  {
    code: 'jefferson-autobiography',
    color: '#b8532f',
    description:
      'The Autobiography of 1821 and the Appendix notes, in The Writings of Thomas Jefferson (Lipscomb & Bergh, 1905), vol. I.',
  },
  {
    code: 'jefferson-anas',
    color: '#8c7a2a',
    description: 'The Anas: Jefferson’s dated memoranda, 1791-1809 (vol. I of the same edition).',
  },
  {
    code: 'jefferson-notes-on-virginia',
    color: '#1d7288',
    description:
      'Notes on the State of Virginia: the twenty-three Queries and the appendices (vol. II).',
  },
  {
    code: 'jefferson-parliamentary-manual',
    color: '#4f8a2b',
    description: 'A Manual of Parliamentary Practice, Sections I to LIII (vol. II).',
  },
  {
    code: 'jefferson-editorial',
    color: '#7e6f8f',
    description:
      'Title pages, introductions, contents and other matter of the two volumes that is not Jefferson’s own text.',
  },
  {
    code: 'jefferson-entities',
    color: '#d17b0f',
    description:
      'People, places, organizations, works, events and things named in the text, each with its mentions.',
  },
] as const;

const PART_PROJECT: Record<string, string> = {
  autobiography: 'jefferson-autobiography',
  anas: 'jefferson-anas',
  'notes-on-virginia': 'jefferson-notes-on-virginia',
  'parliamentary-manual': 'jefferson-parliamentary-manual',
  editorial: 'jefferson-editorial',
};

/** All records are dated from the publication of this edition (1905), a millisecond apart, so the
 *  default newest-first listing keeps the edition's own order. */
const EDITION_EPOCH_MS = Date.UTC(1905, 0, 1);

const BATCH_SIZE = 200;

export interface JeffersonRows {
  records: {
    id: string;
    typeCode: string;
    projectCode: string;
    createdAt: Date;
    title: string;
    description: string | undefined;
    text: string | undefined;
    note: string | undefined;
    references: string[];
    date: Date | undefined;
  }[];
  mentions: {
    id: string;
    recordId: string;
    entityId: string;
    start: number;
    end: number;
    surface: string;
  }[];
}

/** Pure mapping from the generated JSON to row shapes. Ids are the pipeline keys, so URLs and
 *  re-seeds are stable. Throws on a dangling reference rather than skipping it. */
export function buildJeffersonRows(input?: {
  records: JeffersonRecord[];
  entities: JeffersonEntity[];
  mentions: JeffersonMention[];
}): JeffersonRows {
  const { records, entities, mentions } = input ?? {
    records: readJson<JeffersonRecord[]>('records.json'),
    entities: readJson<JeffersonEntity[]>('entities.json'),
    mentions: readJson<JeffersonMention[]>('mentions.json'),
  };

  const rows: JeffersonRows['records'] = [];
  records.forEach((r, i) => {
    const projectCode = PART_PROJECT[r.part];
    if (!projectCode) throw new Error(`Unknown part "${r.part}" on ${r.key}`);
    rows.push({
      id: r.key,
      typeCode: r.type,
      projectCode,
      createdAt: new Date(EDITION_EPOCH_MS + i),
      title: r.title,
      description: r.description,
      text: r.text,
      note: r.note,
      references: r.references,
      date: r.date ? new Date(r.date) : undefined,
    });
  });
  entities.forEach((e, j) => {
    rows.push({
      id: e.key,
      typeCode: e.type,
      projectCode: 'jefferson-entities',
      createdAt: new Date(EDITION_EPOCH_MS + records.length + j),
      title: e.title,
      description: undefined,
      text: undefined,
      note: e.note,
      references: e.references,
      date: undefined,
    });
  });

  const ids = new Set(rows.map((r) => r.id));
  if (ids.size !== rows.length) throw new Error('Duplicate record/entity key in Jefferson data');
  const outMentions = mentions.map((m, k) => {
    if (!ids.has(m.recordKey)) throw new Error(`Mention ${k}: unknown record ${m.recordKey}`);
    if (!ids.has(m.entityKey)) throw new Error(`Mention ${k}: unknown entity ${m.entityKey}`);
    return {
      id: `jefferson-men-${String(k).padStart(5, '0')}`,
      recordId: m.recordKey,
      entityId: m.entityKey,
      start: m.start,
      end: m.end,
      surface: m.surface,
    };
  });
  return { records: rows, mentions: outMentions };
}

async function inBatches<T>(rows: T[], size: number, create: (chunk: T[]) => Promise<unknown>) {
  for (let i = 0; i < rows.length; i += size) await create(rows.slice(i, i + size));
}

/** Adds the Jefferson corpus alongside whatever is already seeded: its own types, six projects,
 *  source records, entity records and mentions. Touches nothing that exists; every type code and
 *  project code must be new (a clash throws). Records have no creator. */
export async function seedJefferson(prisma: PrismaClient): Promise<void> {
  const rows = buildJeffersonRows();

  const typeRows = await Promise.all(jeffersonTypes.map((t) => prisma.type.create({ data: t })));
  const typeIdByCode = new Map(typeRows.map((t) => [t.code, t.id]));

  const projectRows = await Promise.all(
    JEFFERSON_PROJECTS.map((p) => prisma.project.create({ data: { ...p } })),
  );
  const projectIdByCode = new Map(projectRows.map((p) => [p.code, p.id]));

  const recordData = rows.records.map((r) => {
    const typeId = typeIdByCode.get(r.typeCode);
    if (!typeId) throw new Error(`Unknown Jefferson type: ${r.typeCode} (${r.id})`);
    return {
      id: r.id,
      typeId,
      creatorId: null,
      status: 'ACTIVE' as const,
      createdAt: r.createdAt,
      title: r.title,
      description: r.description,
      text: r.text,
      note: r.note,
      references: r.references,
      date: r.date,
    };
  });
  await inBatches(recordData, BATCH_SIZE, (chunk) => prisma.record.createMany({ data: chunk }));

  await inBatches(
    rows.records.map((r) => ({
      projectId: projectIdByCode.get(r.projectCode)!,
      recordId: r.id,
    })),
    2000,
    (chunk) => prisma.projectRecord.createMany({ data: chunk }),
  );

  await inBatches(rows.mentions, 2000, (chunk) => prisma.mention.createMany({ data: chunk }));
}
