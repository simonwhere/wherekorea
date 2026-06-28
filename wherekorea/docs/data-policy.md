# Data Policy — WhereKorea

## 1. Model philosophy
WhereKorea uses a mixed model:
- quantitative signals
- editorial / experiential judgments

Quantitative fields must have a repeatable rule.
Editorial fields must have a clear writing and evidence standard.

## 2. Field definitions

### recommended_stay
Definition:
A recommended stay length for most travelers, based on destination structure, experience density, and movement complexity.

Allowed values:
- 1–2 days
- 3 days
- 4+ days

Method:
- assess destination structure
- review common traveler patterns from reliable travel content and community discussion
- finalize as an editorial recommendation

### live_weather_snapshot
Definition:
A short current or near-term weather summary shown on cards and detail pages.

Default scope for v1:
- this week / 7-day snapshot

Card display format example:
- This week · 14–21°C · mostly dry

### seasonal_weather_context
Definition:
A brief monthly or seasonal baseline shown on detail pages.

Example:
- Typical in April: cool mornings, mild afternoons, generally dry

### card_daily_total  (₩/day — the number shown on cards)
Definition (LOCKED):
Mid traveler **all-in daily total per person**, including lodging, meals, local transport, and light activities.

Reference traveler (persona A):
- 2 people sharing 1 mid-range room (lodging counted per person = half the nightly rate)
- mid-range style, not budget hostel, not luxury

Basket (what the number is the sum of):
- **lodging**: mid-range nightly rate ÷ 2 (persona A). Mid-range = private ensuite room, 3-star / business hotel / quality pension tier, roughly ₩90k–160k/night before split. NOT a dorm; NOT 5-star/luxury.
- **food** (per day): ordinary meal ×2 + uplift meal ×1 + café/dessert
  - ordinary meal = regional 참가격 representative dish (~₩10k)
  - uplift meal = tourist-area / grilled meat / regional specialty (~₩22k)
  - café/dessert = coffee (~₩5k) + dessert (~₩8k) = ~₩13k  *(Korean café culture is a real travel line — not optional)*
  - → Seoul food/day ≈ ₩55k
- **local transport**: subway/bus + occasional taxi (T-money) ≈ ₩10k/day
- **light activities / admissions** ≈ ₩15k/day

Excludes:
- intercity transport to reach the destination (lives in `travel_time` / "from Seoul")
- flights, shopping, heavy nightlife/alcohol

Worked example (Seoul, persona A): lodging ₩130k÷2=₩65k + food ₩55k + transport ₩10k + activities ₩15k ≈ **₩145k/day**.

Sources (primary = Korean official/open data; Numbeo/BudgetYourTrip demoted to cross-check only):
- **food** → 한국소비자원 참가격 외식비 (regional, official) → confidence **high**, refresh ~quarterly
- **lodging** → 지역별 ADR open data (문화빅데이터 / 관광데이터랩 / 야놀자리서치), pick the 일반호텔·3성급 band ÷ 2 → confidence **medium**, refresh ~quarterly
- **local transport, admissions** → official published fares/tickets (e.g. Seoul subway base ₩1,550, verified 2025-06) → confidence **high**, but still carries `last_verified` (fares drift)
- cross-check only: Numbeo, BudgetYourTrip (crowdsourced, USD — never the source of truth)

Confidence is **per destination**, not global:
- big cities with real data (Seoul, Busan, Jeju, Gyeongju) → **medium**
- thin-data destinations (Sokcho, Tongyeong, Namhae, Jirisan) → **low**, and must use an explicit editorial anchor: `anchor city ± %` documented per destination (e.g. Tongyeong ≈ Busan −12%). 참가격 is regional so food still has a real basis even here.

Currency: store all figures in **₩ at capture date**; never store USD. Indicative, not guaranteed — trust comes from tracked `source` + `last_verified`, not false precision.

Full per-destination calibration table: see `budget-calibration.md`.

### card_budget_level  ($/$$/$$$ — coarse tier)
Definition:
A coarse tier derived from the same all-in basket as `card_daily_total`.

Purpose:
Fast at-a-glance comparison; the ₩ number gives the detail.

Labels:
- $   (lower all-in daily total)
- $$  (mid)
- $$$ (higher)

### detail_budget
Definition:
Low / Mid / High daily total including accommodation.

Structure:
- lodging
- food
- local transport
- light admissions / incidentals

### travel_time
Definition:
Fastest practical public-transport route.

Required anchors:
- from central Seoul
- from Incheon Airport
- from Busan Station

### no_car_friendliness
Definition:
How workable the destination is for most travelers without a car.

Allowed values:
- Easy
- Okay
- Hard

Rules:
- Easy: key movement works well via subway and/or bus; major traveler routes are well connected
- Okay: one main transport layer works, but some movement is inefficient or patchy
- Hard: public transport coverage or frequency makes the core experience meaningfully worse without a car

### crowd_friction  (hybrid model — NOT real-time)
Definition:
How much seasonal crowding / access friction a traveler should expect.

Model (documented rule, not a live feed):
```
crowd_level = seasonal baseline
            + weekend / holiday weight
            + event / festival weight
            + (later) partial live data (TourAPI 혼잡도)
            − recent traveler feedback correction
```
v1 is seeded: `crowd_friction` holds the **off-peak / typical baseline tier**. "Now-aware" elevation (when the current month is a peak month, or on weekends/holidays/events) is a later live enhancement — but the data is made ready for it now via `crowd_peak_months`.

Fields:
- `crowd_friction`: baseline tier — Low / Medium / High
- `crowd_peak_months: number[]`: months (1–12) when this destination spikes (e.g. summer beach = [7,8], autumn foliage = [10]). Enables future now-aware crowd + feeds the Best-now ranking.
- `crowd_notes`: timing detail (existing)

Why hybrid not live: a nationwide real-time crowd API is unreliable; seasonal baseline + event/weekend factors + traveler feedback is more honest and stable for v1.

### Trust metadata  (decision C — structure now, UI later)
Every metric that is an estimate carries provenance so the number is a tracked promise, not a guess.

Type:
```
MetricMeta {
  source: 'official' | 'estimate' | 'api' | 'seed'
  confidence: 'high' | 'medium' | 'low'
  last_verified: string   // ISO date, e.g. '2026-06-28'
}
```
Attach (optional) per destination to the metrics that need it:
- `trust.budget`  → confidence per `budget-calibration.md` (big cities medium, thin-data low). source = 'estimate' for now (calibrated, not yet field-verified).
- `trust.crowd`   → confidence by how well the pattern is known. source = 'seed' (editorial baseline).

Rules:
- NOT shown in UI yet (later: detail page compact "last verified" line).
- `last_verified` is mandatory even for `official`/`api` sources (fares, weather drift).
- When traveler feedback ("Was this accurate?") contradicts a value, lower its `confidence` and re-verify.

## 3. Source preference
Prefer this order:
1. official transport / destination info for logistics
2. weather service data for live conditions
3. structured travel pricing checks for budget assumptions
4. community evidence for experiential patterns
5. editorial judgment for final traveler-facing simplification

## 4. Refresh logic
- live weather: refresh frequently when connected to a weather source
- transport assumptions: review periodically
- budget assumptions: review periodically and note they are indicative, not guaranteed
- editorial fields: update when traveler reality or product scope changes
