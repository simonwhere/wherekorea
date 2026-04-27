# PRD v1 — WhereKorea

## 1. Product summary
WhereKorea helps travelers compare destinations in Korea and decide where to go faster.
It should feel like a transparent information layer for destination choice.

## 2. Primary user
First-time or early-stage Korea travelers who want to compare Seoul and non-Seoul destinations clearly.

## 3. Problem statement
Users do not just need more travel information.
They need a clear way to compare destinations by vibe, stay length, access, cost, weather, and practical fit.

## 4. v1 in scope
- Homepage with simplified Korea map
- Search and filter controls
- Destination cards over or alongside the map
- Detail pages for each destination
- Compare tray for 2–3 destinations
- Compare view with shared fields
- Seeded destination dataset
- Measurement events for key behaviors

## 5. v1 out of scope
- Booking, checkout, commerce
- UGC review system
- Full attraction directory
- Data visualization graphs and hover-triggered chart interactions
- Large interactive city-internal neighborhood map systems are out of scope for v1.
- If map context is shown in v1, keep it simple and static.
- Migrate to a structured SVG approach before scaling destination count beyond the core set.
- Nationwide exhaustive coverage

## 6. Homepage requirements
### Layout
- Top area: logo, search, filters
- Main area: map as context + visible destination cards
- Clear compare entry point

### Filters
v1 filters should cover:
- coastal
- history / traditional
- city
- nature
- mountain / hiking
- no-car friendly
- couple
- solo
- 1–2 days
- 3 days
- 4+ days

## 7. Card requirements
Each card must show:
- destination name
- one-line vibe summary
- recommended stay
- live weather snapshot summary
- card budget level
- 2–3 tags

Card must not show:
- full transport module
- multi-anchor travel times
- descriptive body copy (the vibe field is one line only)

## 8. Detail page requirements
Every detail page must include:
- hero summary
- why this destination
- best for / skip if
- access and movement
- weather (live + seasonal baseline)
- food
- budget
- crowd / friction
- insider tips
- similar destinations
- useful links

### Access and movement
Must include:
- from central Seoul
- from Incheon Airport
- from Busan Station
- no-car friendliness
- local movement difficulty
- whether a car is recommended

## 9. Compare requirements
Users must be able to compare 2–3 destinations.

Comparison view should include:
- one-line vibe
- recommended stay
- live weather snapshot
- card budget level
- from Seoul
- no-car friendliness
- crowd level
- best for

## 10. Success criteria
### Product success
The product should help a user quickly narrow and compare destinations.

### Minimum measurable signals
- first card click rate
- compare tray usage rate
- detail page entry rate
- similar destination click rate
- share or copy link rate

## 11. v1 destination set
Core v1 set:
- Seoul
- Busan
- Jeju
- Gyeongju
- Jeonju
- Gangneung
- Sokcho
- Tongyeong
- Namhae
- Jirisan

Expanded v1.1 candidates:
- Andong
- Incheon

## 12. Design direction
- map is supportive, not dominant
- cards are scan-friendly and information-dense without being crowded
- practical, calm, trustworthy tone
