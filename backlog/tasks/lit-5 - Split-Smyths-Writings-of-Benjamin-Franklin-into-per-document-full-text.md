---
id: LIT-5
title: Split Smyth's Writings of Benjamin Franklin into per-document full text
status: Done
assignee: []
created_date: '2026-10-15 15:35'
updated_date: '2026-11-03 04:15'
labels:
  - seed-data
  - franklin
dependencies: []
references:
  - >-
    https://archive.org/download/writingsofbenjam01franuoft/writingsofbenjam01franuoft_djvu.txt
  - .workflow/scratch/wikisource/
  - .workflow/LEDGER-franklin-dataset.md
priority: low
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Of the 14,927 Founders Online documents now seeded for Franklin, only 15 carry verbatim full text (Wikisource Dogood letters + Gutenberg's Poor Richard Improved) — everything else has metadata and an exact reference only. The authoritative scholarly edition, Smyth's 10-volume "The Writings of Benjamin Franklin" (1905-07), is not on Wikisource, but its full OCR text is available from the Internet Archive (public domain) as raw per-volume text (e.g. https://archive.org/download/writingsofbenjam01franuoft/writingsofbenjam01franuoft_djvu.txt). Splitting that OCR into individual documents and matching each to its Founders Online permalink would substantially raise full-text coverage beyond the current ~0.1%.

This was scoped out of the initial Franklin-dataset rebuild (see prisma/seed/ pipeline, commits on tdd-types-entry-data-routes) as a separate, larger follow-up: the OCR has no per-document markers, document boundaries within each volume need custom splitting logic, and OCR quality beyond the opening lines of volume 1 was not verified.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Internet Archive OCR text (_djvu.txt) for all 10 Smyth volumes is fetched and cached on disk, with an honest User-Agent and polite rate limiting
- [x] #2 OCR text for each volume is split into individual per-document entries (letters, essays, etc.) with enough reliability to spot-check correctness
- [x] #3 Each split document is matched to its Founders Online record by date + title/correspondent, conservatively: an ambiguous or low-confidence match is left unmatched rather than guessed
- [x] #4 Matched text is merged into the corresponding record's `text` field via the existing prisma/seed/pipeline/text-merge.ts mechanism, with the Internet Archive source URL added to that record's references
- [x] #5 A report documents match rate, OCR quality issues found, and the count of documents left unmatched
- [x] #6 Re-running the matching/merge step against the same cached OCR input is deterministic (no network, no randomness)
- [x] #7 Unit tests cover the document-splitting and matching logic
- [x] #8 The regenerated seed still passes the existing invariants: every record keeps its Founders Online reference, no duplicate permalinks introduced
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Pipeline in prisma/seed/sources/smyth/ (fetch, split, match, build). 1,743 documents split, 1,005 matched and merged; records with full text went from 17 to 1,022 of 24,550 (0.1% to 4.2%). Results: prisma/seed/sources/smyth/REPORT.md.

Not measured: precision against Founders Online transcriptions. founders.archives.gov answers scripted requests with an AWS WAF challenge (HTTP 202, x-amzn-waf-action: challenge), and it was not bypassed. SPOT-CHECK.md has a fixed sample of 40 matches with record links for checking in a browser. A separate review pass read about 60 matches and all title-rule matches and found no wrong match after fixes.

To rebuild: tsx prisma/seed/sources/smyth/fetch.ts, then build.ts, then prisma/seed/generate.ts. The OCR cache is uncommitted, in .workflow/scratch/smyth/. Status left for the owner to change.

Review round 1 fixes: note stripping no longer deletes letter text when a signed note's mark is garbled; Franklin's own notes signed '— F.' are kept. 115 of 1,005 merged texts can still contain some of Smyth's note text, reported in REPORT.md.
<!-- SECTION:NOTES:END -->
