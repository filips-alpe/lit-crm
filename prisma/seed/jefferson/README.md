# Jefferson corpus pipeline

Turns the Internet Archive OCR of Lipscomb & Bergh, _The Writings of Thomas Jefferson_ (1905), volumes I and II
(item `writingsofthomas0000vari_v5r4`), into typed records, curated entities and linked mentions. No network at
generate time, no model, byte-identical on re-run. Counts, link rate, OCR issues and the hyphen audit are in
[`REPORT.md`](./REPORT.md), which the generator writes; nothing in this file repeats those numbers.

## Re-running

```sh
tsx prisma/seed/jefferson/generate.ts        # writes prisma/seed/generated/jefferson/*.json and REPORT.md
bunx vitest run --project unit prisma/seed/jefferson
```

The source files are cached and md5-checked in `prisma/seed/sources/jefferson/` (see `sources.manifest.json`). `fetch.ts`
downloads a missing file once, with the user agent `lit-crm seed pipeline (https://github.com/filips-alpe/lit-crm)`, and
verifies it; a cached file is never fetched again. `generate.ts` only reads the cache. A test stubs `fetch` and asserts it
is never called, and another regenerates everything and compares it to the committed output byte for byte.

## Contents map

Line numbers are 1-based lines of `_djvu.txt`. Every line belongs to exactly one record (front and end matter become
records too).

| part                   | what                                                                                     | raw lines   | printed pages |
| ---------------------- | ---------------------------------------------------------------------------------------- | ----------- | ------------- |
| `editorial` (vol. I)   | cover and library stamps, title page, officers, special introduction, Lincoln, contents  | 1-983       | unnumbered    |
| `autobiography`        | editors' note, the Autobiography of 1821 (no headings), then Appendix notes A to H       | 984-11302   | 2-262         |
| `anas`                 | editors' note, the explanation, then the dated memoranda                                 | 11303-19865 | 266-492       |
| `editorial` (vol. II)  | title page, address on the University of Virginia, contents, illustrations               | 19866-21608 | unnumbered    |
| `notes-on-virginia`    | editors' notes, Queries I to XXIII, Appendix Nos. I to IV, the Logan depositions         | 21609-36619 | 3-330         |
| `parliamentary-manual` | title page, introduction, Sections I to LIII, catalogue card and scan residue at the end | 36620-41639 | 331-450       |

The Autobiography is cut at topical anchors (an anchor is a verbatim opening phrase, asserted against the text); the
titles are supplied by this dataset and each record's `note` says so. The Appendix notes are one record each, the Anas one
record per dated memorandum, the Logan appendix one record per signed statement.

## Types and why

Defined in data (`types.yaml`), validated against `typeSchema` and `layoutSchema` (`types.test.ts`). Codes do not reuse
any code in `prisma/seed/data/types.yaml`. Each layout starts with the title, has the text as
`kind: markdown, writeTo: text`, and the references as `kind: list, writeTo: references`. Types were derived from what the
two volumes contain, not borrowed from the Franklin set:

- `memoir-section`: Jefferson's own retrospective narrative. The Autobiography has no internal headings, so the unit is a stretch of narrative.
- `memorandum`: the Anas entries, and the appendix pieces the volume itself prints as memoranda or notes. Carries the date as printed (`description`) and an ISO `date` only when day and year are both stated and read unambiguously.
- `query`: the twenty-three numbered Queries. Keeps the printed question in `description`, since it is the heading and the title is derived from it.
- `manual-section`: the fifty-three numbered sections of the Manual of Parliamentary Practice, each a rule with its authorities.
- `correspondence-copy`: a letter or extract copied into an appendix. Not `letter`: the Franklin type models sender and recipient as people, and here they are named only inside the text.
- `official-paper`: a drafted public instrument in an appendix: instructions, a bill, an act, a draft constitution.
- `deposition`: a sworn or signed statement in the Logan appendix.
- `editorial-note`: matter by the editors or others than Jefferson, kept apart so that mentions in it are never read as Jefferson's words.
- `front-matter`: title pages, rosters, contents, illustrations and scan residue. Exists so that every line has an owner. Never linked.
- Entity types, no renderer, no body text: `person`, `people` (a nation or tribe, not an adjective of nationality), `place`, `organization`, `work`, `event`, `thing`. `people` is separate from `organization` because the Notes on Virginia names many tribes and the text treats them as peoples.

Source types set `rendererId: source-text` (annotated text with mention links); entity types set none.

## Cleanup rules (`clean.ts`)

The only changes between the scan and a record's text are logged in `cleanup-log.json` as `{rawLine, kind, raw, result}`:

1. Page furniture is removed by explicit pattern: running heads, page numbers, signature marks (`VOL. I-23`), library stamps. Real upper-case headings are not matched.
2. Lines of a prose block are joined with single spaces. Blocks (blank-line separated) become paragraphs separated by a blank line. Short-line blocks and tables keep their inner newlines.
3. Line-end hyphens: if the joined form occurs elsewhere in the corpus, join; if only the hyphenated form does, keep the hyphen; if neither, a short reviewed list and number compounds keep the hyphen, everything else joins. Where the OCR lost text and the next line starts another word (a handful of cases, listed in the report), the hyphen stays and the break becomes a space. Every decision and its reason is logged, and the report lists every default join.
4. When furniture was removed across a page break, the previous block has no terminal punctuation and the next starts lower case, the two paragraphs are merged.
5. Footnotes stay where the OCR put them, verbatim. OCR typos, letterspacing and spelling are never corrected.

The invariant, tested on the real cache for every record: the text with whitespace removed equals the concatenation of its raw
lines with the logged furniture lines and the logged joined hyphens removed. A record boundary is always the first line of a
text block and never a page-merged paragraph, so cleaning each record on its own gives exactly the cleaning of the whole.

Titles may repair OCR damage (`QUERY ETLI` is read as Query III from its position in the series, `how jar` as `how far`)
and say so in `note`; the record text is never touched.

## Entities and linking

`gazetteer.yaml` was curated by hand: capitalised name candidates were mined from the cleaned text (`candidates.ts`), read in
context, and kept only where the reading was clear. It holds `{key, name, type, aliases[], scopedAliases?}` and a top-level
`ambiguous: [{surface, candidates[], reason}]`. It records names, types and variants only, no biographical facts.

- `link.ts` is pure: case-sensitive, whole words, longest match first, non-overlapping, and `text.slice(start, end) === surface` always. A possessive links the name, not the `'s`. A hyphen inside a word is not a boundary.
- A bare surface that could name more than one entity (Adams, Randolph, Washington, Lee, Morris, Livingston, Henry, Clinton, Franklin, Madison, Jefferson, Lincoln, Hamilton, Smith; Ohio, Mississippi, Delaware) is listed under `ambiguous` and is never linked. It is still consumed, so that no shorter alias can leak a link out of it.
- `scopedAliases` resolve a surface only inside one part of the text, where reading the text justified it: `Randolph` is Edmund in the Anas and Peyton in the Autobiography; `Hamilton` is Alexander in the Anas; `Logan` is the chief only in the Notes on Virginia. A scoped alias may override an ambiguous surface; it may not shadow another entity's global alias.
- No alias may map to two entities (`entities.test.ts`). When in doubt a surface is left out and shows up under "top unlinked surfaces" in the report.
- Front-matter records are never linked.

Link rate = linked / (linked + ambiguous-unlinked + unmatched capitalised name candidates); defined and reported per part in `REPORT.md`.

## Output shapes (consumed by the seed)

`prisma/seed/generated/jefferson/`

- `records.json`: `[{key, type, part, title, description?, text, note?, references[], date?, rawLineStart, rawLineEnd, leafStart, leafEnd, pageStart, pageEnd, volume}]`
- `entities.json`: `[{key, type, title, note?, references[], mentionCount}]`, only entities with at least one mention
- `mentions.json`: `[{recordKey, entityKey, start, end, surface}]`, offsets into the record `text`
- `cleanup-log.json`: `[{recordKey, rawLine, kind, raw, result, reason?}]`

Every record and entity carries `Internet Archive: https://archive.org/details/writingsofthomas0000vari_v5r4` and a
location such as `Lipscomb & Bergh, The Writings of Thomas Jefferson (1905), vol. I, pp. 2-4 (leaves 39-42; djvu_txt lines 1007-1123)`.
An entity's location is its first mention. Leaf and printed page of every raw line come from the hOCR page index and
`page_numbers.json` (`pages.ts`); a leaf with no printed page reads "unnumbered pages".

## Modules

| file             | role                                                               |
| ---------------- | ------------------------------------------------------------------ |
| `fetch.ts`       | cache-first download, md5 manifest, injectable `fetch`             |
| `pages.ts`       | raw line to `{leaf, page, volume}`                                 |
| `clean.ts`       | furniture, unwrapping, hyphen rule; `cleanRange` is the only entry |
| `split.ts`       | boundary manifest and tolerant heading series; asserts 23 and 53   |
| `types.yaml`     | the types (see above)                                              |
| `gazetteer.yaml` | entities, scoped aliases, ambiguous surfaces                       |
| `entities.ts`    | parse, validate and index the gazetteer                            |
| `link.ts`        | `linkMentions`, `linkRecord`                                       |
| `candidates.ts`  | capitalised name candidates for mining and the link rate           |
| `dataset.ts`     | assembles records, entities, mentions, log                         |
| `report.ts`      | renders `REPORT.md`                                                |
| `generate.ts`    | writes the outputs                                                 |
