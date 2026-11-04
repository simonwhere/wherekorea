'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Destination } from '@/data/types'
import { DAILY_AVG, KOREAN_NAMES } from '@/data/destinations-meta'
import { track } from '@/lib/analytics'
import { usdApprox } from '@/lib/currency'
import { type BrowseState, withBrowseContext } from '@/lib/browse-state'
import { seasonFit } from '@/lib/best-now'
import TimingStrip from '@/components/shared/TimingStrip'
import BudgetFitNote from '@/components/shared/BudgetFitNote'
import { COMPARE_DEPARTURES } from '@/lib/compare-state'
import { comparisonDepartureFromSearch, comparisonFromSearch, comparisonHref } from '@/lib/compare-navigation'

interface Props {
  destinations: Destination[]
  canonicalPath: string
  browse: BrowseState
  homeHref: string
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const VALID_SLUGS = Object.keys(KOREAN_NAMES)
export default function CompareView({ destinations, canonicalPath, browse, homeHref }: Props) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const router = useRouter()
  const params = useSearchParams()
  const currentSearch = params?.toString() ?? canonicalPath.split('?')[1] ?? ''
  const departure = comparisonDepartureFromSearch(currentSearch)
  const departureOption = COMPARE_DEPARTURES.find((option) => option.value === departure)!
  const departureLabel = departureOption.label
  const month = MONTHS[browse.month - 1]

  async function handleCopyLink() {
    try {
      const slugs = comparisonFromSearch(window.location.search, VALID_SLUGS) ?? destinations.map((d) => d.slug)
      await navigator.clipboard.writeText(window.location.origin + comparisonHref(slugs, window.location.search))
      track('copy_link_clicked')
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  function detailHref(d: Destination) {
    return withBrowseContext(`/destination/${d.slug}`, currentSearch)
  }

  function price(d: Destination) {
    const amount = DAILY_AVG[d.slug]
    return amount ? `${amount} · ≈${usdApprox(amount) ?? '—'} / person / day` : 'Estimate unavailable'
  }

  function seasonLabel(d: Destination) {
    const fit = seasonFit(d, browse.month)
    return fit === 35 ? 'Recommended month'
      : fit === 18 ? 'Shoulder season'
        : 'Off-season'
  }

  const rows: { label: string; render: (d: Destination) => ReactNode }[] = [
    { label: 'Recommended stay', render: (d) => <strong>{d.recommended_stay}</strong> },
    { label: 'Daily estimate', render: price },
    { label: `From ${departureLabel}`, render: (d) => d.travel_time[departureOption.route] },
    { label: 'Without a car', render: (d) => <><strong className={d.no_car_friendliness === 'Hard' ? 'caution' : ''}>{d.no_car_friendliness}</strong><span className="cell-note">{d.local_movement}</span></> },
    { label: month, render: (d) => <><strong>{seasonLabel(d)}</strong><span className="cell-note">{d.seasonal_weather_context}</span></> },
    { label: 'Year at a glance', render: (d) => <TimingStrip destination={d} currentMonth={browse.month} compact /> },
    ...(browse.mode === 'now' ? [{ label: 'Current / near-term weather', render: (d: Destination) => d.live_weather_is_live ? d.live_weather_snapshot : 'Live forecast unavailable — check before departure.' }] : []),
    { label: 'Crowds', render: (d) => <>{d.crowd_peak_months.includes(browse.month) ? 'Usually a busier month' : `Typical level: ${d.crowd_friction.toLowerCase()}`}<span className="cell-note">{d.crowd_notes}</span></> },
    { label: 'Highlights', render: (d) => d.best_for },
    { label: 'Practical notes', render: (d) => d.skip_if },
    { label: 'Food', render: (d) => d.food },
  ]

  return (
    <div className="compare-page">
      <div className="compare-tools">
        <Link className="back-link" href={homeHref}>← Your results</Link>
        <button className="copy-button" onClick={handleCopyLink}>{copyStatus === 'copied' ? 'Link copied ✓' : 'Copy link'}</button>
      </div>
      <div className="title-row">
        <div>
          <p className="eyebrow">{browse.mode === 'now' ? 'Current conditions' : month}</p>
          <h1>Compare destinations</h1>
          <p className="intro">Stay, cost, transport and things to see — side by side.</p>
          {browse.maxDailyKrw !== undefined && <p className="text-xs text-white/70 mt-3">Daily budget filter: ₩{browse.maxDailyKrw.toLocaleString('en-US')} / person. Places above it remain marked below.</p>}
        </div>
      </div>
      {copyStatus !== 'idle' && <p role="status" className="copy-status">{copyStatus === 'failed' ? 'Could not copy. Copy the page address from your browser.' : 'Link copied with your destinations, departure and filters.'}</p>}

      <div className="departure-control">
        <label htmlFor="compare-departure">Getting there from</label>
        <select id="compare-departure" value={departure} onChange={(event) => {
          const next = COMPARE_DEPARTURES.find((option) => option.value === event.target.value)
          if (!next) return
          const slugs = comparisonFromSearch(window.location.search, VALID_SLUGS) ?? destinations.map((d) => d.slug)
          const href = comparisonHref(slugs, window.location.search, next.value)
          window.history.replaceState(null, '', href)
          router.replace(href, { scroll: false })
          setCopyStatus('idle')
        }}>
          {COMPARE_DEPARTURES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
        <p>Approximate main routes; station transfers and waiting time may be extra.</p>
      </div>

      <section aria-labelledby="differences-heading">
        <h2 id="differences-heading" className="summary-heading">The key differences</h2>
        {destinations.length === 3 && <p className="summary-scroll-hint">Swipe across for all 3 destinations →</p>}
        <div className="decision-grid" tabIndex={0} role="region" aria-label="Key destination differences, scroll horizontally to see all destinations" style={{ gridTemplateColumns: `repeat(${destinations.length}, minmax(0, 1fr))` }}>
          {destinations.map((d) => (
              <article className="decision-card" key={d.slug}>
                <div className="card-title"><h3><Link href={detailHref(d)}>{d.name} ↗</Link></h3><span>{d.recommended_stay}</span></div>
                <p className="vibe">{d.card_vibe}</p>
                <BudgetFitNote slug={d.slug} browse={browse} />
                <dl className="quick-facts">
                  <div><dt>Daily estimate</dt><dd>{DAILY_AVG[d.slug] ?? '—'} <span>≈{usdApprox(DAILY_AVG[d.slug] ?? '') ?? '—'}</span></dd></div>
                  <div><dt>Without a car</dt><dd className={d.no_car_friendliness === 'Hard' ? 'caution' : ''}>{d.no_car_friendliness}</dd></div>
                </dl>
                <p className="field-label">From {departureLabel}</p>
                <p className="route-copy">{d.travel_time[departureOption.route]}</p>
              </article>
          ))}
        </div>
      </section>

      <details className="assumptions">
        <summary>Daily estimates: per person, 2 sharing a mid-range room</summary>
        <div>Includes meals, local transport and light activities. Intercity travel, flights and shopping are extra. Room prices vary by date. USD uses a fixed July 2026 reference rate.
          <span>Season and crowd notes describe usual patterns, not current conditions.</span>
        </div>
      </details>

      <section aria-labelledby="details-heading">
        <h2 id="details-heading">Compare the practical details</h2>
        <p className="table-help">Scroll across on small screens. Destination names and row labels stay visible inside the table.</p>
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Destination comparison details, scroll horizontally and vertically">
          <table style={{ minWidth: 140 + destinations.length * 240 }}>
            <caption className="sr-only">Destination comparison for {month}. {browse.mode === 'plan' ? 'Seasonal planning, not a weather forecast.' : 'Includes available current weather.'}</caption>
            <thead><tr><th scope="col">At a glance</th>{destinations.map((d) => <th scope="col" key={d.slug}><Link href={detailHref(d)}>{d.name} ↗</Link></th>)}</tr></thead>
            <tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{destinations.map((d) => <td key={d.slug}>{row.render(d)}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="legend">Year strip: green = recommended months · amber = neighboring months · dot = usual crowd peak · outline = {month}.</p>
      </section>
      <div className="bottom-actions"><Link href={homeHref}>← Browse destinations</Link></div>

      <style jsx>{`
        .compare-page { color: #f5f4ef; }
        .back-link { color: #c3cbd6; font-size: 12px; }
        .compare-tools { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
        .title-row { margin: 18px 0 24px; }
        .eyebrow { color: #ffac88; text-transform: uppercase; letter-spacing: .1em; font-size: 10px; font-weight: 700; margin: 0 0 10px; }
        h1 { font-size: clamp(26px, 3.2vw, 39px); line-height: 1.15; letter-spacing: -.035em; font-weight: 700; max-width: 700px; }
        .intro { max-width: 660px; font-size: 14px; line-height: 1.6; color: #b8c2cf; margin-top: 12px; }
        .copy-button { padding: 8px 12px; white-space: nowrap; border: 1px solid #526074; border-radius: 9px; color: #f5f4ef; background: #26313f; cursor: pointer; font-size: 12px; }
        .copy-button:hover { border-color: #ff936b; }
        .copy-button:focus-visible, .table-scroll:focus-visible, .decision-grid:focus-visible, select:focus-visible, summary:focus-visible { outline: 2px solid #ff936b; outline-offset: 3px; }
        .departure-control { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 15px 0 23px; }
        .departure-control label { font-size: 12px; color: #e5e9ef; font-weight: 600; }
        .departure-control select { background: #26313f; color: #f5f4ef; border: 1px solid #526074; border-radius: 8px; min-height: 44px; padding: 8px 32px 8px 12px; font-size: 13px; max-width: 100%; }
        .departure-control p { flex-basis: 100%; color: #b8c2cf; font-size: 11px; line-height: 1.6; }
        .copy-status { color: #ffb495; font-size: 12px; margin-bottom: 20px; }
        h2 { font-size: 17px; font-weight: 650; margin: 0 0 14px; letter-spacing: -.01em; }
        .decision-grid { display: grid; gap: 14px; }
        .summary-scroll-hint { display: none; }
        .decision-card { padding: 20px; border: 1px solid #3e4a5c; border-radius: 15px; background: #1d2530; display: flex; flex-direction: column; }
        .card-title { display: flex; justify-content: space-between; gap: 10px; align-items: center; }
        h3 { font-size: 23px; font-weight: 700; letter-spacing: -.03em; }
        .card-title > span { font-size: 11px; padding: 5px 7px; background: #ff936b17; color: #ffb495; border-radius: 5px; white-space: nowrap; }
        .vibe { color: #aab7c8; font-size: 12px; margin-top: 6px; }
        .quick-facts { display: grid; grid-template-columns: 1.3fr 1fr; gap: 10px; border-top: 1px solid #364251; border-bottom: 1px solid #364251; padding: 14px 0; margin: 17px 0; }
        dt { color: #aab7c8; font-size: 10px; margin-bottom: 5px; }
        dd { font-size: 16px; font-weight: 650; }
        dd span { font-size: 11px; font-weight: 400; color: #b8c2cf; }
        .field-label { text-transform: uppercase; font-size: 9px; letter-spacing: .1em; font-weight: 700; color: #ffb495; margin-bottom: 6px; }
        .route-copy { font-size: 12px; line-height: 1.65; }
        summary { cursor: pointer; }
        .assumptions { font-size: 11px; color: #b8c2cf; line-height: 1.7; padding: 17px 0 26px; }
        .assumptions > div { padding-top: 10px; }
        .assumptions span { display: block; margin-top: 5px; }
        .table-help { color: #aab7c8; font-size: 11px; margin: -5px 0 12px; }
        .table-scroll { overflow: auto; max-height: 72vh; border: 1px solid #3b4758; border-radius: 12px; }
        table { width: 100%; border-collapse: separate; border-spacing: 0; text-align: left; table-layout: fixed; }
        th, td { padding: 16px; border-bottom: 1px solid #344050; vertical-align: top; font-size: 12px; line-height: 1.65; }
        thead th { position: sticky; top: 0; z-index: 2; background: #2a3544; font-size: 16px; color: #f5f4ef; }
        th:first-child { width: 140px; position: sticky; left: 0; background: #202a36; z-index: 1; font-size: 11px; font-weight: 600; color: #c7cfda; border-right: 1px solid #3b4758; }
        thead th:first-child { z-index: 3; background: #2a3544; }
        td { background: #1b232e; color: #e5e9ef; }
        tr:last-child th, tr:last-child td { border-bottom: 0; }
        .cell-note { display: block; color: #aab7c8; margin-top: 6px; font-size: 11px; line-height: 1.6; }
        .caution { color: #ffc09a; }
        .legend { font-size: 10px; color: #aab7c8; line-height: 1.6; margin-top: 10px; }
        .bottom-actions { display: flex; flex-wrap: wrap; gap: 14px; align-items: center; margin-top: 26px; font-size: 12px; }
        .bottom-actions a { color: #ffb495; }
        @media (max-width: 700px) {
          .title-row { margin: 14px 0 18px; }
          h1 { font-size: 28px; }
          .eyebrow { font-size: 9px; margin-bottom: 7px; }
          .intro { font-size: 11px; margin-top: 7px; }
          .copy-button { font-size: 11px; }
          .summary-heading { font-size: 14px; margin-bottom: 10px; }
          .summary-scroll-hint { display: block; font-size: 10px; color: #b8c2cf; margin: -4px 0 9px; }
          .decision-grid { grid-template-columns: none !important; grid-auto-flow: column; grid-auto-columns: calc((100% - 8px) / 2); gap: 8px; overflow-x: auto; scroll-snap-type: x proximity; align-items: start; padding-bottom: 5px; }
          .decision-card { padding: 12px; border-radius: 11px; scroll-snap-align: start; }
          .card-title { display: block; }
          h3 { font-size: 19px; }
          .card-title > span { display: inline-block; margin-top: 6px; font-size: 10px; padding: 3px 6px; }
          .vibe { font-size: 10px; line-height: 1.4; min-height: 28px; }
          .quick-facts { grid-template-columns: 1fr; gap: 9px; margin: 10px 0; padding: 10px 0; }
          dt { font-size: 9px; margin-bottom: 2px; }
          dd { font-size: 16px; }
          dd span { font-size: 10px; }
          .field-label { font-size: 8px; }
          .route-copy { font-size: 11px; }
          .assumptions { font-size: 10px; padding: 12px 0 20px; }
          .table-scroll { max-height: 65vh; }
          th:first-child { width: 116px; }
          th, td { padding: 13px; }
        }
      `}</style>
    </div>
  )
}
