# AGENTS.md — execution rules for coding agents

## Read order before doing work
1. `CLAUDE.md`
2. `docs/PRD-v1.md`
3. `docs/data-policy.md`
4. `docs/destination-taxonomy.md`
5. the task-specific document if one exists

## How to work
- Make the smallest coherent change that completes the requested task.
- Prefer stable data structures over premature backend complexity.
- Use static or seeded data first unless the task explicitly requires live integration.
- Keep UI readable and easy to scan.

## Core reference
CLAUDE.md defines the product boundary. If a task conflicts with it, flag before implementing.
This file covers implementation-level behavior only — it does not restate product philosophy.

## What to challenge
Flag the task if it starts to drift into:
- dense attraction directory behavior
- overdesigned hover-heavy interactions
- ambiguous shorthand like “reuse the old stuff” or “use the WhereNow structure” without naming exact sections

## Task output style
When finishing a task, summarize:
- what changed
- what assumptions were used
- what is still undefined
- what the next smallest useful step is

# AGENTS.md Addendum — WhereKorea Skill Read Order

Use this as a patch/addition to the current `AGENTS.md`.

## Recommended read order before doing work
1. `CLAUDE.md`
2. `docs/PRD-v1.md`
3. `docs/design-system.md`
4. `docs/data-policy.md`
5. `docs/destination-taxonomy.md`
6. `docs/editorial-guidelines.md`
7. relevant `docs/skills/*.md`
8. the task-specific prompt

## Skill selection rule
Do not read every skill file by default. Select only the files relevant to the task.
Only these five skill files exist under `docs/skills/`: 06, 07, 08, 10, 11.

Examples:
- Any code change → `10-implementation-guardrails.md` (always; covers master-detail, preview panel, mobile invariants)
- Card / image / redesign → `07-image-curation.md`, `11-design-qa.md`
- Filter/search → `06-filter-search.md`, `11-design-qa.md`
- Compare → `08-compare.md`

## Completion report addition
When finishing UX/code tasks, also report:
- whether browsing context is preserved
- whether filters/search/compare state were affected
- whether the change impacts analytics events