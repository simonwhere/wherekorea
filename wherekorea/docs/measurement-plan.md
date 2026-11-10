# Measurement Plan — WhereKorea v1

## Goal
Validate whether the product actually helps users compare and narrow destinations.

## Primary events
- homepage_view
- filter_used
- card_clicked
- compare_added
- compare_view_opened
- detail_page_viewed
- similar_destination_clicked
- share_clicked
- copy_link_clicked

## Minimum KPI set
- first card click rate
- compare tray usage rate
- detail page entry rate
- similar destination click rate
- share / copy link rate

## Supporting diagnostics
- median time to first card click
- average number of destinations added to compare
- detail page scroll depth

## How to interpret
- High card clicks but low compare usage may mean the compare CTA is weak.
- High detail entry but low similar-destination clicks may mean the detail page answers the question well, or the similar block is poorly placed.
- Low first click rate may mean the homepage is not legible enough.

## Walking guides reopened on a later date

Run `npm run walk:report` from the WhereKorea application directory using the Vercel CLI account that manages WhereKorea. The report prints totals and a daily table in Korean. It opens the private WhereKorea Blob store using the project's production environment. `npm run walk:report -- --qa` reads the test partition.

Each group starts when this browser saves a walk, shares a walk successfully, or first opens a tagged shared link. A return counts when that browser reopens the same walk on a later Korean calendar date. Each browser/walk counts once per group. A browser can appear in several groups. The denominator in the total excludes starts dated today. The report credits each return to the date of the original action. An offline delivery can change an earlier group's figures.

The collection endpoint writes one private marker per action and one per first return. Marker paths contain the cohort date, walk slug, group and a hash of a random ID scoped to this walk and action. It stores no contact information, full share URL or visitor-wide identifier. Clearing browser storage or switching browsers prevents matching some returns. Same-browser returns cannot distinguish a person from others using that browser.

For production smoke tests, mark every metrics POST with `x-wherekorea-metrics-test: 1` using the test browser. Start with the clock set to yesterday in Korea, complete a save or share, then reopen the walk with the clock set to today's real date. Confirm that same-day reloads and multiple later opens stay at one return, and read the test report. The public health response exposes `walkMetricsConfigured` for this collector. Only successful writes and the owner report establish that delivery works.
