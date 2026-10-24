import { isPromptApiAvailable, type TypeContext } from '$lib/forms/aiSuggest';
import { sampleIcons, TYPE_ICONS, type TypeIcon } from './typeIcons';

function buildSchema(count: number) {
  return {
    type: 'array',
    minItems: 1,
    maxItems: count,
    items: { type: 'string', enum: [...TYPE_ICONS] },
  };
}

function buildSystemPrompt(count: number): string {
  return [
    `You pick visual icons for a CRM record type. Return ${count} icon names`,
    'from the provided catalog only, ranked best-first by how well each one',
    'visually represents the type. Never invent names; pick only from the',
    'allowed list. Respond with a JSON array of strings.',
  ].join('\n');
}

function buildUserPrompt(context: TypeContext): string {
  const lines: string[] = [];
  if (context.typeCode?.trim()) lines.push(`Type code: "${context.typeCode.trim()}".`);
  if (context.typeDescription?.trim()) {
    lines.push(`Type description: "${context.typeDescription.trim()}".`);
  }
  lines.push('Return the best-fit icon names as a JSON array.');
  return lines.join('\n');
}

function validate(raw: unknown): TypeIcon[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: TypeIcon[] = [];
  for (const item of raw) {
    if (typeof item !== 'string') continue;
    if (seen.has(item)) continue;
    if (!(TYPE_ICONS as readonly string[]).includes(item)) continue;
    seen.add(item);
    out.push(item as TypeIcon);
  }
  return out;
}

async function rankViaPromptApi(
  context: TypeContext,
  count: number,
  signal?: AbortSignal,
): Promise<TypeIcon[]> {
  const model = globalThis.LanguageModel;
  if (!model) return [];
  const session = await model.create({
    temperature: 0.3,
    topK: 3,
    initialPrompts: [{ role: 'system', content: buildSystemPrompt(count) }],
    signal,
  });
  try {
    const reply = await session.prompt(buildUserPrompt(context), {
      responseConstraint: buildSchema(count),
      signal,
    });
    return validate(JSON.parse(reply));
  } finally {
    session.destroy();
  }
}

function padWithRandom(picks: TypeIcon[], count: number): TypeIcon[] {
  if (picks.length >= count) return picks.slice(0, count);
  const filler = sampleIcons(count - picks.length, picks);
  return [...picks, ...filler];
}

export async function suggestIcons(
  context: TypeContext,
  count: number,
  signal?: AbortSignal,
): Promise<TypeIcon[]> {
  const keywords = [context.typeCode, context.typeDescription]
    .filter((s): s is string => !!s && s.trim().length > 0)
    .join(' ')
    .trim();

  if (!keywords) return sampleIcons(count);
  if (!(await isPromptApiAvailable())) return sampleIcons(count);

  try {
    const ranked = await rankViaPromptApi(context, count, signal);
    if (ranked.length === 0) return sampleIcons(count);
    return padWithRandom(ranked, count);
  } catch {
    return sampleIcons(count);
  }
}
