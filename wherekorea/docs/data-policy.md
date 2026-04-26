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

### card_budget_level
Definition:
Mid traveler daily spend excluding accommodation.

Purpose:
Fast comparison on cards.

Suggested labels:
- $
- $$
- $$$

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

### crowd_friction
Definition:
How much seasonal crowding or access friction a traveler should expect.

Inputs:
- peak season
- major holiday windows
- festival periods
- weekend crowding patterns

Allowed values:
- Low
- Medium
- High

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
