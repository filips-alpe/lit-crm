---
id: LIT-6
title: >-
  Add Thomas Jefferson dataset from Lipscomb & Bergh with linked entities and
  best-page UI
status: Done
assignee: []
created_date: '2026-10-30 10:04'
updated_date: '2026-11-06 00:43'
labels:
  - seed-data
  - jefferson
dependencies: []
references:
  - >-
    https://archive.org/stream/writingsofthomas0000vari_v5r4/writingsofthomas0000vari_v5r4_djvu.txt
  - 'https://archive.org/details/writingsofthomas0000vari_v5r4'
  - lit-crm-seeds repo, seed/pipeline/
  - lit-crm-seeds repo, extension/
priority: medium
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a new dataset from the Internet Archive OCR of "The Writings of Thomas Jefferson" (Definitive Edition, ed. Lipscomb & Bergh, Thomas Jefferson Memorial Association, Washington D.C., 1905), organized into the best-fitting types and records. The original text stays intact, but mentions of people and things in it become clickable references. Each referenced entity opens a best page: a page composed from whatever data exists for that entity, through one isomorphic UI rather than a bespoke template per entity.

**Source, as checked on 2026-10-30:** a single `_djvu.txt` of about 1.6 MB and 1,062 page images. The item is metadata-labelled volume I-II and the title page reads "Vol. I". Only the start, middle and end were sampled: front matter, biographical prose about Jefferson mid-file, and parliamentary-procedure text on impeachment at the end. The exact contents still need mapping. It is only part of the 20-volume edition, so it does not contain all of Jefferson's writings; other volumes are out of scope.

**OCR quality:** the sampled prose reads well, but the front matter and end pages are noisy. Sampled artefacts include garbled scan text, library stamps, broken letterspacing ("JEF FERSON") and end-of-line hyphenation ("discon-/tinued"). Running heads are likely too, but were not seen in the samples.

**Starting points:** the Franklin pipeline in `seed/pipeline/` in the lit-crm-seeds repo and the extension layout in `extension/` in the lit-crm-seeds repo. Franklin's bespoke renderers and dashboards are not the target pattern for the entity pages, which must stay generic.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Source OCR is fetched once with an honest User-Agent and cached on disk; re-running the pipeline against the cache is deterministic and uses no network
- [x] #2 The contents of the volume are mapped and split into individual records (e.g. autobiography sections, letters, papers, manual chapters), with each boundary traceable to its source location
- [x] #3 Types are defined from what the text actually contains, and each record is assigned to one; the type choices and their rationale are documented
- [x] #4 Each record keeps the original wording verbatim; OCR cleanup is limited to documented mechanical fixes (running heads, page furniture, line-end hyphenation) and any correction is traceable to the raw text
- [x] #5 People, places, organizations, works and other entities mentioned in the text are extracted into their own records, with variant names resolved to one entity; ambiguous mentions are left unlinked rather than guessed
- [x] #6 Entity mentions render as clickable links inside the original text without altering the displayed wording
- [x] #7 Clicking an entity opens a best page assembled from its available data (e.g. fields, mentions in context, related entities, source records), with sections omitted when there is no data for them
- [x] #8 Entity pages use one isomorphic UI driven by data, with no per-entity or per-type bespoke template, and the same links and page work in server-rendered and client-navigated views
- [x] #9 Every record and entity carries its source reference (Internet Archive item, plus volume and page or location where recoverable)
- [x] #10 A report documents record and entity counts, link rate, OCR issues found and mentions left unlinked
- [x] #11 Unit tests cover splitting, OCR cleanup, entity resolution and mention linking; the dataset seeds cleanly alongside the existing data without changing Franklin records
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ready for owner review (status left To Do). Second, independent implementation on current main; pushed as branch autoplay/lit-6-r2 because origin/autoplay/lit-6 already holds an earlier implementation (2026-10-31, based on old main 72a5965, with e2e). Both merge cleanly into current main; pick one.

- Pipeline: prisma/seed/sources/jefferson/ (fetch, pages, clean, contents, split, entities, build, report; README.md has types rationale and rules). Cache: .workflow/scratch/jefferson/ (gitignored). Rebuild: bunx tsx prisma/seed/sources/jefferson/build.ts (no network, byte-identical output).
- Result: 217 documents (4 memoir, 114 memorandum incl. 110 Anas entries, 7 epistle, 10 paper, 23 query, 54 rule, 5 editorial), 413 entities, 5,129 linked mentions in 207 documents; link rate 64% over gazetteer matches. Counts, OCR issues and unlinked names in REPORT.md; every correction with its raw line in corrections.tsv.
- Storage/UI: additive RecordMention table (migration 20261106120000_record_mentions); generic best page at /page/[id] for any record (src/lib/bestPage/assemble.ts), linked from /data/[id] as 'Open page'. Jefferson records have no creator, so existing dashboards and Franklin records/types are unchanged.
- Verified on PGlite (no local Postgres here): migrations apply, full seed runs twice cleanly (26,458 records); server tests 159 passed, 4 failed. The 4 failures are pre-existing auth tests that still expect '/login' without the ?redirectTo= LIT-3 added. Unit+client 963 passed, svelte-check 0 errors, lint clean. SSR and client navigation of /page/[id] checked in Chrome.
- A fresh reviewer found: stray running heads, broken hyphens/footnotes at page breaks, an OCR-digit Anas year (18oo), and wrong links (Lincoln county, George Logan, Greene county). All fixed, with regression tests.
- Known limits: about 15 paragraphs still end in a broken hyphen; some plate OCR stays in front matter; 'Grey', 'Hatsell' etc. link to the parliamentary authorities they cite. No e2e spec was added.

Review round 1 (CHANGES) addressed: (1) bare 'New York'/'New-York' now unlinked (city vs state is ambiguous in this text; no unambiguous form occurs, so the state entity drops out), regression test against the real gazetteer; (2) best-page text heading falls back to a paraglide message (sharp_lost_cuckoo_commend, en/lv) instead of hardcoded 'Text'; (3) BestPage list/reference loops keyed by index, component test with duplicate values. Checks: unit+client 966 passed, svelte-check 0 errors, lint clean, best-page server tests 7/7 on PGlite, rebuild byte-identical.

Review round 2 (CHANGES) addressed: (1) updateRecord clears a record's RecordMention rows in the same transaction when its text changes (unchanged text keeps them); server tests cover edit → no linked segments, same-text edit keeps mentions. (2) best-page mention total counts only ACTIVE source records (test). (3) removed the no-op honest_tasty_gazelle_sail message; <title> uses the record title. Checks: server 162 passed / 4 pre-existing auth failures (also on main) on PGlite; unit+client 966 passed; svelte-check 0; lint clean.
<!-- SECTION:NOTES:END -->
