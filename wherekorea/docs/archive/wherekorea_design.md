# WhereKorea `design.md`

> Purpose: Build a Korea travel discovery homepage inspired by the information density of Nomads.com, but not a visual clone.  
> Product direction: “Nomads.com for Korea travel discovery” + “Time Out-style editorial curation” + “map/list comparison utility.”

---

## 1. Product Goal

WhereKorea helps travelers quickly decide **where in Korea to go right now**.

The homepage should answer three questions within 5 seconds:

1. **Where should I go?**  
2. **Why now?**  
3. **Is it practical for my trip?** — weather, budget, crowd level, travel time, vibe, event timing.

This is not a generic tourism homepage. It should feel like a practical decision tool.

---

## 2. Reference Direction

### 2.1 Primary Reference: Nomads.com

Use Nomads.com as a reference for:

- Dense destination cards
- Clear ranking logic
- Strong numerical metrics
- Filter-first browsing
- Comparison behavior
- City/destination scores
- Utility-first layout
- Small but information-rich UI

Do **not** copy:

- Exact visual style
- Exact card layout
- Exact colors
- Exact text
- Exact icon treatment
- Paywall/community patterns unless product scope requires it

### 2.2 Secondary References

#### Time Out
Use for:
- Editorial modules
- “Best right now” sections
- Seasonal travel lists
- City/culture/food/event framing
- Magazine-like headlines

#### Atlas Obscura
Use for:
- Hidden gems
- Curious places
- “Random place” discovery
- Local story-driven cards
- Unexpected Korea experiences

#### Wanderlog
Use for:
- Map + list hybrid
- Saved places
- Trip planning flow
- Itinerary utility
- Clean travel planner language

#### Roadtrippers
Use for:
- Route-based discovery
- Region-to-region travel planning
- Road trip / train trip modules

#### The Infatuation
Use for:
- Food-first city guides
- Strong editorial judgment
- Clear “where to eat” modules

#### VisitKorea
Use for:
- Official information credibility
- Destination taxonomy
- Korean tourism basics
- Data/reference validation  
But do not copy its visual style; it is too institutional for this product.

---

## 3. Design Principles

### 3.1 Information Must Be Scannable

The user should not need to read paragraphs to understand a destination.

Each destination card should expose:

- Destination name
- Region
- Hero image
- One-line reason to go now
- Weather
- Estimated daily budget
- Crowd level
- Travel time from Seoul
- Best month / season
- Main category
- Score or recommendation badge

### 3.2 Numbers Should Be Visually Loud

The current weakness to avoid: icons and prices are too subtle.

Important metrics must be large, bold, and readable:

- `22°C`
- `₩95k/day`
- `2h 15m`
- `Low crowd`
- `May peak`
- `4.6`

Use numbers as UI anchors, not decoration.

### 3.3 Destination Images Must Be Specific

No generic landscape images.

Each card image should represent the destination clearly:

- Seoul: skyline, palaces, Han River, neighborhoods
- Busan: ocean, Haeundae, Gamcheon, bridges
- Jeju: oreum, coastline, Hallasan, stone walls
- Gyeongju: tombs, hanok, Woljeonggyo, historical sites
- Gangneung / East Coast: sea, pine forests, coffee street
- Sokcho / Seoraksan: mountain peaks, coastal town, fall foliage
- Jeonju: hanok village, food, old town
- Andong: Hahoe Village, traditional houses
- Tongyeong: islands, harbor, cable car
- Yeosu: night sea, islands, cable car

If the image does not instantly communicate the place, reject it.

### 3.4 The Homepage Should Feel Like a Tool, Not a Blog

Editorial taste is useful, but the primary UX is decision-making.

Good:
- “Best for spring flowers”
- “Best low-crowd weekend trip”
- “Best food city this month”
- “Best 2-hour train escape from Seoul”

Bad:
- Generic “Explore Korea”
- Long tourism copy
- Stock-photo-heavy hero sections
- Overly emotional brand language

---

## 4. Homepage Information Architecture

### Section 1 — Top Navigation

Desktop:
- Left: WhereKorea logo
- Center: Explore / Map / Compare / Guides / When to Go
- Right: Search / Saved / Language toggle

Mobile:
- Logo
- Search icon
- Menu icon
- Bottom sticky compare/save tray if items are selected

Navigation should be simple and utility-driven.

---

### Section 2 — Hero

Hero goal: immediately explain the product.

Suggested headline:

> Find the best places to visit in Korea right now.

Subheadline:

> Compare Korean destinations by weather, cost, crowd level, seasonality, events, and travel time.

Primary CTA:
- `Explore destinations`

Secondary CTA:
- `See this month’s picks`

Hero layout:
- Left: headline + search bar + quick filters
- Right: compact preview grid of 3–4 destination cards or map preview

Avoid a giant full-screen image hero. It wastes space.

---

### Section 3 — Search + Filter Bar

This is the core control layer.

Search placeholder:
> Search cities, regions, seasons, food, festivals...

Sticky filter chips:
- This month
- Weekend trip
- Near Seoul
- Low crowd
- Food
- Nature
- Beach
- Mountains
- Culture
- Family
- Dog-friendly
- Budget-friendly
- Train-friendly
- Hidden gems

Advanced filters:
- Month
- Region
- Travel time from Seoul
- Budget
- Weather
- Crowd level
- Trip length
- Vibe
- Transportation
- Event type

Filters should be visually strong. They should look clickable, not like weak text tags.

---

### Section 4 — Featured Ranking Row

Title:
> Best places in Korea right now

Subtitle:
> Ranked by seasonality, weather, crowd level, events, and travel practicality.

Layout:
- Horizontal tabs:
  - Overall
  - Weekend
  - Food
  - Nature
  - Culture
  - Low crowd
  - Near Seoul
- Destination cards in responsive grid

Each card should have a clear rank:
- `#1`
- `Best in May`
- `Low crowd`
- `2h from Seoul`

---

## 5. Destination Card Specification

### 5.1 Card Layout

Card structure:

1. Image area
2. Top overlay badges
3. Destination title
4. One-line “Why now”
5. Primary metric row
6. Secondary tags
7. Save / Compare actions

Example:

```txt
[#1] [Best in May]

Jeju Island
Peak spring coastlines, oreum hikes, and mild weather.

22°C        ₩110k/day       Medium crowd
Weather     Budget          Crowd

Nature · Island · 3–4 days · Flight
[Save] [Compare]
```

### 5.2 Card Metrics

Every card should expose 3–4 key metrics.

Required:
- Weather: `22°C`
- Budget: `₩95k/day`
- Crowd: `Low / Medium / High`
- Travel time: `2h 15m from Seoul`

Optional:
- Event: `Festival now`
- Season: `Peak season`
- Score: `8.7`
- Dog-friendly: `Dog-friendly`
- Food strength: `Food city`
- Transit: `KTX-friendly`

### 5.3 Visual Hierarchy

Metric numbers:
- Font size: 18–24px on desktop
- Font weight: 700–800
- Label size: 11–12px
- High contrast

Destination name:
- Font size: 20–24px
- Font weight: 700

Why-now line:
- Font size: 13–15px
- Max 2 lines
- Muted but readable

Badges:
- Small pill shape
- Clear contrast
- Do not overuse colors

### 5.4 Image Rules

Images should be:
- Destination-specific
- High-resolution
- Cropped consistently
- Slightly darkened only if overlay text is used
- No generic Unsplash filler
- No random cafes unless the destination is specifically about cafe culture
- No low-recognition close-ups

Recommended aspect ratio:
- Desktop card: 4:3 or 16:10
- Mobile card: 16:10

---

## 6. Visual System

### 6.1 Overall Feel

The product should feel:

- Clean
- Sharp
- Data-rich
- Modern
- Travel-native
- Slightly editorial
- More “smart travel dashboard” than “government tourism portal”

### 6.2 Color Direction

Use a neutral base with one strong accent.

Base:
- Background: `#F7F4EE` or `#FAFAF7`
- Surface: `#FFFFFF`
- Text primary: `#171717`
- Text secondary: `#5F6368`
- Border: `#E5E1D8`

Accent options:
- Korea red: `#E94B35`
- Deep blue: `#1E5EFF`
- Forest green: `#1F7A5A`
- Warm orange: `#F97316`

Recommendation:
Use neutral warm background + one red/orange accent for “right now” energy.

### 6.3 Typography

Use a clean sans-serif.

Recommended:
- Inter
- Pretendard
- Geist
- Manrope

Rules:
- Headline: bold, tight, 48–72px desktop
- Section title: 28–36px
- Card title: 20–24px
- Metric number: 18–24px
- Body: 14–16px
- Labels: 11–12px

Korean and English should both render well.

### 6.4 Spacing

Use dense but breathable spacing.

- Page max width: 1200–1320px
- Card gap: 16–24px
- Section padding: 56–88px desktop
- Mobile section padding: 32–48px
- Card padding: 14–18px
- Border radius: 18–24px

---

## 7. Key Homepage Sections

### 7.1 “Best Right Now”

Purpose:
Show top destinations based on current month.

Cards:
- 8–12 destinations
- Ranking visible
- Metrics visible
- Filterable

---

### 7.2 “Choose by Trip Type”

Purpose:
Help users who do not know city names.

Categories:
- 2-day weekend
- Food trip
- Nature escape
- Beach trip
- Mountain trip
- Historic Korea
- Low-crowd trip
- Family trip
- Dog-friendly trip
- Rainy-day friendly

Use compact category cards.

---

### 7.3 “Map + List Preview”

Purpose:
Support spatial decision-making.

Layout:
- Left: map preview
- Right: destination list
- Chips: Seoul nearby / East Coast / Jeju / South Coast / Historic cities

MVP can use a static map placeholder first, but the layout should be ready for interactive map later.

---

### 7.4 “Seasonal Korea”

Purpose:
Own the timing-based travel positioning.

Tabs:
- Spring
- Summer
- Autumn
- Winter
- This month

Examples:
- Cherry blossoms
- Fall foliage
- Beach season
- Snow trips
- Food festivals
- Temple stays
- Island season

---

### 7.5 “Hidden but Worth It”

Purpose:
Differentiate from generic Korea travel sites.

Style:
- More editorial
- Story-driven
- Inspired by Atlas Obscura
- Lower data density than main cards

Each card:
- Place name
- Region
- Image
- “Why it’s special”
- Best month
- Practical note

---

### 7.6 “Compare Destinations”

Purpose:
Push utility and repeat usage.

Module:
- Select up to 3 destinations
- Compare:
  - Weather
  - Budget
  - Crowd
  - Travel time
  - Best for
  - Weakness
  - Recommended trip length

Important:
The compare feature should be visible from the homepage, not hidden.

---

## 8. Interaction Design

### 8.1 Filter Behavior

- Filters update card grid instantly.
- Selected filters should be visibly active.
- Filter state should be reflected in URL query params.
- Filter chips should be horizontally scrollable on mobile.
- Add “Clear all” when filters are active.

### 8.2 Compare Behavior

- Users can compare up to 3 destinations.
- Once selected, show sticky compare tray.
- Tray should show destination thumbnails.
- CTA: `Compare 2 places`
- Disable or explain when user tries to add more than 3.

### 8.3 Card Hover

Desktop hover:
- Image slightly zooms
- Card shadow increases subtly
- Compare/save actions become more visible
- Metrics remain stable; do not move layout

Mobile:
- No hover dependency
- Save and compare actions always visible

### 8.4 Loading State

Use skeleton cards:
- Image block
- Title line
- Metric row
- Tags

Avoid spinners where possible.

---

## 9. Responsive Rules

### Desktop

- 3 or 4-column card grid
- Sticky filter bar
- Optional map preview
- Compare tray bottom-right or bottom full-width

### Tablet

- 2-column grid
- Horizontal filter chips
- Compact hero

### Mobile

- 1-column card list
- Search at top
- Filter chips sticky under header
- Large metric numbers
- Compare tray bottom sticky
- No tiny icons

---

## 10. Data Model for Destination Cards

Use this structure for mock data:

```ts
type Destination = {
  slug: string;
  name: string;
  koreanName?: string;
  region: string;
  country: "South Korea";
  imageUrl: string;
  imageAlt: string;

  rank?: number;
  score?: number;
  recommendationLabel?: string;

  whyNow: string;
  bestMonths: string[];
  currentMonthFit: "excellent" | "good" | "okay" | "poor";

  weather: {
    tempC: number;
    condition: string;
    label: "Great" | "Good" | "Okay" | "Bad";
  };

  budget: {
    dailyKrw: number;
    label: "Budget" | "Moderate" | "Premium";
  };

  crowd: {
    level: "Low" | "Medium" | "High";
    note?: string;
  };

  travelTimeFromSeoul: {
    label: string;
    minutes: number;
    transport: "KTX" | "Flight" | "Car" | "Bus" | "Subway";
  };

  categories: string[];
  tags: string[];
  tripLength: string;
  isDogFriendly?: boolean;
  hasFestivalNow?: boolean;
};
```

---

## 11. Component List for Claude Design / Claude Code

Build these components:

1. `HomepageHero`
2. `SearchBar`
3. `FilterChipBar`
4. `DestinationGrid`
5. `DestinationCard`
6. `MetricPill`
7. `CategoryRail`
8. `SeasonalKoreaSection`
9. `HiddenGemsSection`
10. `MapListPreview`
11. `CompareTray`
12. `NewsletterOrWaitlistCTA`

---

## 12. Destination Card Acceptance Criteria

A card is successful if:

- The destination is recognizable from the image.
- The destination name is readable in under 1 second.
- Weather, budget, and crowd are visible without zooming.
- The “why now” reason is clear in one sentence.
- Save and compare actions are easy to find.
- The card works on mobile without hidden hover-only actions.
- The UI does not feel like a generic travel blog card.

---

## 13. Homepage Acceptance Criteria

The homepage is successful if:

- Users understand the product within 5 seconds.
- Users can browse destinations by month, region, and trip type.
- Users can compare destinations from the homepage.
- Cards feel information-rich but not cluttered.
- The page has a distinctive Korea travel identity.
- The visual system is cleaner and more premium than VisitKorea.
- The utility is closer to Nomads.com than a tourism magazine.
- The editorial taste is closer to Time Out than a government portal.

---

## 14. Anti-Patterns to Avoid

Do not:

- Use tiny low-contrast icons for key metrics.
- Hide price, weather, or crowd data inside detail pages only.
- Use random destination images.
- Make the homepage just a blog feed.
- Overuse gradients.
- Use too many badge colors.
- Make filters look like passive labels.
- Make users click into a card just to understand basic fit.
- Copy Nomads.com pixel-for-pixel.
- Use generic tourism slogans.

---

## 15. Suggested First Build Scope

For the first homepage iteration, build only:

1. Hero with search and quick filters
2. Best Right Now destination grid
3. Strong destination card component
4. Category rail
5. Compare tray
6. Seasonal Korea section

Do not build full map, full itinerary planner, user accounts, or community yet.

The priority is to prove that users can quickly compare Korean destinations and find places worth visiting now.

---

## 16. Claude Design Prompt

Use this prompt with Claude Design:

```txt
Build a modern responsive homepage for WhereKorea, a Korea travel discovery product.

The product helps travelers decide where in Korea to go right now by comparing destinations based on weather, budget, crowd level, seasonality, events, and travel time from Seoul.

Use Nomads.com as inspiration for dense destination cards, ranking, filtering, visible metrics, and comparison utility. Do not copy Nomads.com visually. Add Time Out-style editorial travel curation and Atlas Obscura-style hidden gems.

The homepage should include:
- Header navigation
- Hero section with search and quick filters
- Sticky filter chip bar
- “Best places in Korea right now” ranking grid
- Destination cards with strong images and large readable metrics
- Category rail for trip types
- Seasonal Korea section
- Hidden gems section
- Compare tray for up to 3 destinations
- Mobile-first responsive behavior

Design direction:
- Clean, data-rich, premium, modern
- Warm neutral background
- White cards
- Strong metric typography
- Rounded cards
- Clear filters
- No tiny icons
- No generic blog layout
- No generic tourism portal look

Make the destination card the hero component of the product. It must show:
- Destination image
- Destination name
- Region
- One-line why-now reason
- Weather
- Daily budget
- Crowd level
- Travel time from Seoul
- Save and compare actions

Use realistic Korea destination examples:
Seoul, Busan, Jeju, Gyeongju, Gangneung, Sokcho/Seoraksan, Jeonju, Andong, Tongyeong, Yeosu.
```

---

## 17. MVP Priority

The first design review should focus on:

1. Are the destination cards instantly readable?
2. Are the images destination-specific?
3. Are price/weather/crowd visually strong?
4. Are filters useful and clickable?
5. Does it feel like a decision tool rather than a blog?
6. Does the homepage have enough Korea-specific identity?
