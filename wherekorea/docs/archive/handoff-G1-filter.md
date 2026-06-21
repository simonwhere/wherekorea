# Claude Code 작업 지시문 — G1 필터 통합

> VS Code의 Claude Code에 아래 블록을 그대로 붙여넣으세요.

---

Read these first:
- `CLAUDE.md`
- `docs/skills/10-implementation-guardrails.md` (always-on)
- `docs/skills/06-filter-search.md`
- `docs/skills/11-design-qa.md`

## Task (G1, option A)
Make the homepage use ONE narrowing UI. Keep the "Best now" curated ranking as the default; add FilterStrip as the trait-based narrowing layer; remove the duplicate filter UI.

Concretely:
1. In `components/homepage/HomepageClient.tsx`, replace `RefineBar` with `components/homepage/FilterStrip.tsx`.
2. Keep `CategoryRail` and the "Best now" default category exactly as-is — it is the ranking/curation, not a filter. Do not remove it.
3. Change the homepage filter state from `refineFilters: string[]` to `activeFilters: FilterTag[]` (type from `@/data/types`), wired to FilterStrip's `activeFilters` / `onToggle` / `onClearAll`.
4. For the actual filtering, REUSE `lib/filters.ts` `filterDestinations(list, activeFilters, searchQuery)` instead of the inline `filterByRefine`. This makes `lib/filters.ts` live and removes duplicated logic. Apply it AFTER the category filter (`matchesCategory`).
   - Note: `filterDestinations` currently matches search against `name` only. Preserve the existing broader search (name + card_vibe + tags) — either extend `filterDestinations` minimally or keep search separate. Keep the change small.
5. Delete `components/homepage/RefineBar.tsx` only if nothing else imports it (grep first).

## Constraints (from skill 10)
- Smallest coherent change. No redesign, no unrelated refactors.
- Selected-destination single source of truth stays the URL (`?destination=slug`). Do not touch selection/preview logic.
- Preserve on filter change: selected destination, compare state (max 3), scroll, category.
- FilterTag enum values and filter matching logic must stay aligned with `data/types.ts` / `data-policy.md`.
- Remove the dead path: after this, only ONE of {FilterStrip, RefineBar} exists, and `lib/filters.ts` is used (not orphaned).

## Verify
- `npx tsc --noEmit`
- `npm run build`
- (optional) add `"typecheck": "tsc --noEmit"` to package.json scripts.
- Then run the skill 11 design-QA checklist for filters + master-detail.

## Report
- Files changed + why
- State/filtering approach (how category + tags + search compose)
- tsc result, build result
- Whether browsing/compare/scroll state is preserved
- Any leftover dead code or TODOs
- Next smallest useful step (likely G2: preview panel photo carousel)
