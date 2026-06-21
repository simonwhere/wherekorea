# CLAUDE.md — WhereKorea core rules

> Session start: also read `docs/PROJECT-BRIEF.md` first — it is the single entry point
> (vision, collaboration workflow, doc map, current status, planning backlog).

## Product identity
WhereKorea is a decision tool for choosing travel destinations in Korea.
It is not a generic travel portal, booking layer, or attraction directory.

## Core principles
- Map is context. Cards are primary.
- Compare before deep read.
- The goal is faster destination choice, not more content.
- Use simple destination names on main cards.
- Put richer structure inside detail pages.

## v1 interaction rules
- No hover graphs in v1.
- Homepage browsing should preserve context.
- During homepage exploration, card click opens a selected-destination preview panel, not a forced full-page transition.
- Desktop/tablet: card click opens a right-side detail preview panel while keeping cards visible.
- Mobile: card click opens a bottom sheet or drawer while preserving list scroll and filter state.
- Dedicated detail pages still exist for SEO, sharing, and deeper guide content.
- Cards can show compact travel practicality signals, but full multi-anchor travel time belongs on detail pages.
- Compare tray and compare view are in scope for v1.
- Food is in scope for v1, but do not turn it into a restaurant listing product.
- Neighborhoods are useful, but large city-internal map systems are v1.5 unless explicitly requested.

## Skill usage rules
Before design or code changes, read the relevant skill file under `docs/skills/`.
These five files exist; do not reference others.

- Any code change → `docs/skills/10-implementation-guardrails.md` (always-on; includes master-detail, preview panel, and mobile invariants)
- Filter/search work → `docs/skills/06-filter-search.md`
- Image work → `docs/skills/07-image-curation.md`
- Compare work → `docs/skills/08-compare.md`
- Design review / QA → `docs/skills/11-design-qa.md`

Do not read every skill file for tiny edits. Pick only the relevant ones.

## Current UX priority
The current priority is to make homepage discovery easier.
The user should be able to browse, select, inspect, compare, and continue browsing without losing context.
Do not turn the homepage into a full article page, booking flow, or itinerary planner.

## Naming rules
- Use simple, traveler-recognizable names for main cards.
- Keep complex sub-regions inside detail pages.
- Do not use broad labels like “East Coast” as the primary card name when travelers actually compare Gangneung and Sokcho separately.
- Region labels such as “East Coast” can be used as tags or collection groupings.

## Destination naming examples
- Sokcho → detail page includes Seoraksan context
- Jirisan → detail page includes access bases and trail context
- Jeju → detail page can include Hallasan context

## Map rules
- Early exploration can use Claude-generated visual directions or rough map concepts.
- If the homepage map-plus-card layout proves useful in testing, migrate the map to a production-safe SVG/vector structure before scaling the destination count.
- Production maps should be structured, stable, and editable.

## Writing rules
- Be practical, not tourism-board promotional.
- Prefer decision language such as:
  - best for
  - skip if
  - easier with a car
  - one night is enough
- Avoid exaggerated certainty.

## Non-goals for v1
- Full nationwide destination coverage
- Flight booking, hotel booking, payments
- UGC review community
- Individual attraction cards as a navigation unit (destination cards are the unit)
- Long-form narrative writing as a content pattern (compact section blocks are the pattern)
