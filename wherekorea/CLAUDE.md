# CLAUDE.md — WhereKorea core rules

## Product identity
WhereKorea is a decision tool for choosing travel destinations in Korea.
It is not a generic travel portal, booking layer, or attraction directory.

## Core principles
- Map is context. Cards are primary.
- Compare before deep read.
- The goal is faster destination choice, not more content.
- Use simple destination names on main cards.
- Put richer structure inside detail pages.
- Avoid vague shorthand references to previous projects.
- If reusing a past content structure, name the exact reusable sections explicitly.

## v1 interaction rules
- No hover graphs in v1.
- Card click goes to detail page.
- Travel time belongs on detail pages, not cards.
- Compare tray and compare view are in scope for v1.
- Food is in scope for v1, but do not turn it into a restaurant listing product.
- Neighborhoods are useful, but large city-internal map systems are v1.5 unless explicitly requested.

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
- Recommended stay is a guide for most travelers, not an absolute truth.

## Non-goals for v1
- Full nationwide destination coverage
- Flight booking, hotel booking, payments
- UGC review community
- Attraction cards everywhere
- Long-form editorial essays as the main UX
