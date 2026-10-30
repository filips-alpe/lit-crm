---
id: LIT-6
title: >-
  Add Thomas Jefferson dataset from Lipscomb & Bergh with linked entities and
  best-page UI
status: To Do
assignee: []
created_date: '2026-10-30 10:04'
labels:
  - seed-data
  - jefferson
dependencies: []
references:
  - >-
    https://archive.org/stream/writingsofthomas0000vari_v5r4/writingsofthomas0000vari_v5r4_djvu.txt
  - 'https://archive.org/details/writingsofthomas0000vari_v5r4'
  - prisma/seed/pipeline/
  - src/extensions/franklin/
priority: medium
type: feature
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create a new dataset from the Internet Archive OCR of "The Writings of Thomas Jefferson" (Definitive Edition, ed. Lipscomb & Bergh, Thomas Jefferson Memorial Association, Washington D.C., 1905), organized into the best-fitting types and records. The original text stays intact, but mentions of people and things in it become clickable references. Each referenced entity opens a best page: a page composed from whatever data exists for that entity, through one isomorphic UI rather than a bespoke template per entity.

**Source, as checked on 2026-10-30:** a single `_djvu.txt` of about 1.6 MB and 1,062 page images. The item is metadata-labelled volume I-II and the title page reads "Vol. I". Only the start, middle and end were sampled: front matter, biographical prose about Jefferson mid-file, and parliamentary-procedure text on impeachment at the end. The exact contents still need mapping. It is only part of the 20-volume edition, so it does not contain all of Jefferson's writings; other volumes are out of scope.

**OCR quality:** the sampled prose reads well, but the front matter and end pages are noisy. Sampled artefacts include garbled scan text, library stamps, broken letterspacing ("JEF FERSON") and end-of-line hyphenation ("discon-/tinued"). Running heads are likely too, but were not seen in the samples.

**Starting points:** the Franklin pipeline in `prisma/seed/pipeline/` and the extension layout in `src/extensions/franklin/`. Franklin's bespoke renderers and dashboards are not the target pattern for the entity pages, which must stay generic.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Source OCR is fetched once with an honest User-Agent and cached on disk; re-running the pipeline against the cache is deterministic and uses no network
- [ ] #2 The contents of the volume are mapped and split into individual records (e.g. autobiography sections, letters, papers, manual chapters), with each boundary traceable to its source location
- [ ] #3 Types are defined from what the text actually contains, and each record is assigned to one; the type choices and their rationale are documented
- [ ] #4 Each record keeps the original wording verbatim; OCR cleanup is limited to documented mechanical fixes (running heads, page furniture, line-end hyphenation) and any correction is traceable to the raw text
- [ ] #5 People, places, organizations, works and other entities mentioned in the text are extracted into their own records, with variant names resolved to one entity; ambiguous mentions are left unlinked rather than guessed
- [ ] #6 Entity mentions render as clickable links inside the original text without altering the displayed wording
- [ ] #7 Clicking an entity opens a best page assembled from its available data (e.g. fields, mentions in context, related entities, source records), with sections omitted when there is no data for them
- [ ] #8 Entity pages use one isomorphic UI driven by data, with no per-entity or per-type bespoke template, and the same links and page work in server-rendered and client-navigated views
- [ ] #9 Every record and entity carries its source reference (Internet Archive item, plus volume and page or location where recoverable)
- [ ] #10 A report documents record and entity counts, link rate, OCR issues found and mentions left unlinked
- [ ] #11 Unit tests cover splitting, OCR cleanup, entity resolution and mention linking; the dataset seeds cleanly alongside the existing data without changing Franklin records
<!-- AC:END -->
