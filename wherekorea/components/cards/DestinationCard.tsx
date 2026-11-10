'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Destination } from '@/data/types'
import { DAILY_AVG, KOREAN_NAMES, REGIONS } from '@/data/destinations-meta'
import { type BrowseState, currentKoreaMonth } from '@/lib/browse-state'
import { recommendationReasons } from '@/lib/recommendation'
import { seasonFit } from '@/lib/best-now'
import { MONTH_SHORT, isPeakNow } from '@/lib/crowd'
import { usdApprox } from '@/lib/currency'
import { track } from '@/lib/analytics'
import { useCompare } from '@/lib/compare-context'
import { useSaved } from '@/lib/saved-context'
import KoreaMiniMap from '@/components/shared/KoreaMiniMap'
import PhotoCredit from '@/components/shared/PhotoCredit'

// Art direction, not a data claim. Keep the landmark in view as the card grows.
const PHOTO_POSITION: Record<string, string> = {
  seoul: '50% 50%', busan: '64% 45%', jeju: '70% 50%', gyeongju: '54% 50%',
  jeonju: '50% 50%', gangneung: '60% 50%', sokcho: '50% 45%',
  tongyeong: '40% 60%', namhae: '38% 50%', jirisan: '50% 50%',
  yeosu: '50% 50%', andong: '48% 50%', suwon: '28% 50%',
  chuncheon: '50% 50%', 'damyang-boseong': '45% 50%',
}

interface Props {
  destination: Destination
  onSelect: () => void
  isSelected: boolean
  walk?: { label: string; route: string; href: string; more?: { label: string; href: string }; festival?: { label: string; href: string } }
  bestNowReason?: string
  month?: number
  browse?: BrowseState
}

export default function DestinationCard({ destination: d, onSelect, isSelected, walk, month = currentKoreaMonth(), browse, bestNowReason }: Props) {
  const { compareList, toggleCompare } = useCompare()
  const { savedList, toggleSaved } = useSaved()
  const [imgError, setImgError] = useState(false)
  const inCompare = compareList.includes(d.slug)
  const isSaved = savedList.includes(d.slug)
  const limitReached = compareList.length >= 3 && !inCompare
  const selectedMonth = browse?.month ?? month
  const isNow = browse?.mode === 'now'
  const season = seasonFit(d, selectedMonth)
  const seasonLabel = season === 35 ? 'Good season' : season === 18 ? 'Shoulder season' : 'Off-season'
  const cost = DAILY_AVG[d.slug] ?? d.card_budget_level
  const dollars = usdApprox(cost)
  const mobility = d.no_car_friendliness === 'Easy' ? 'Easy without a car'
    : d.no_car_friendliness === 'Okay' ? 'Some transit planning' : 'Car helpful'
  const rationale = browse ? recommendationReasons(d, browse).reasons : []

  function preview() {
    track('card_clicked', { slug: d.slug })
    onSelect()
  }

  return (
    <article className={`wk-destination-card${isSelected ? ' is-selected' : ''}${imgError ? ' has-no-photo' : ''}`} data-destination={d.slug}>
      <div className="wk-card-image">
        {!imgError ? (
          // Existing destination-specific editorial photography; no generated travel imagery.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={d.image.src} alt={d.image.alt} style={{
            objectPosition: PHOTO_POSITION[d.slug] ?? '50% 50%',
            // Keep the hanok rooftops above the text, not the modern skyline.
            ...(d.slug === 'jeonju' ? { transform: 'scale(1.6)', transformOrigin: '50% 100%' } : {}),
          }}
            onError={() => setImgError(true)} loading="lazy" decoding="async" />
        ) : <span className="wk-photo-unavailable">{d.name} · photo unavailable</span>}
      </div>
      <div className="wk-card-topline" aria-hidden="true">
        <span className="wk-card-region">{REGIONS[d.slug]}</span>
        <span className="wk-card-map"><KoreaMiniMap slug={d.slug} size={31} /></span>
      </div>
      <button type="button" className="wk-card-hitarea" onClick={preview}
        aria-label={`Preview ${d.name}`} aria-pressed={isSelected} />
      {!imgError && <PhotoCredit image={d.image} className="wk-card-credit" compact />}
      <div className="wk-card-body">
        <div className="wk-card-title"><h2>{d.name}</h2><span lang="ko">{KOREAN_NAMES[d.slug]}</span></div>
        {walk && <Link className="wk-card-walk" href={walk.href} prefetch={false}>
          <span className="wk-card-walk-name">{walk.label}</span>
          <strong>{walk.route}</strong>
          <span className="wk-card-walk-arrow" aria-hidden="true">→</span>
        </Link>}
        <p className="wk-card-vibe">{d.card_vibe}</p>
        <div className="wk-card-signals">
          <span className={`wk-signal ${season === 35 ? 'is-good' : ''}`}>{MONTH_SHORT[selectedMonth - 1]} · {seasonLabel}</span>
          <span className="wk-mobility">{mobility}</span>
        </div>
        <div className="wk-card-metrics">
          <div><strong>{d.recommended_stay}</strong><span>Recommended stay</span></div>
          <div><strong>{cost}<small> / day</small></strong><span>{dollars ? `≈ ${dollars} · per person, est.` : 'Per person, estimate'}</span></div>
        </div>
        {isNow && <p className="wk-card-weather">{d.live_weather_is_live
          ? `${d.live_weather_icon ?? ''} ${d.live_weather_current ?? '—'}° now · ${bestNowReason ?? 'Current conditions only'}`
          : 'Current weather unavailable · seasonal guidance shown'}</p>}
        {!!browse?.filters.length && rationale.length > 1 && <p className="wk-card-reason">{rationale[1]}</p>}
        {isPeakNow(d, selectedMonth) && <p className="wk-card-caution">Usually a busier month here</p>}
        {walk?.festival && <Link className="wk-card-related" href={walk.festival.href}>{walk.festival.label} →</Link>}
        {walk?.more && <Link className="wk-card-related" href={walk.more.href}>{walk.more.label} →</Link>}
        <div className="wk-card-actions">
          <span className="wk-card-detail-hint">Explore <span aria-hidden>↗</span></span>
          <button type="button" className="wk-save-button" aria-label={isSaved ? `Remove ${d.name} from saved` : `Save ${d.name}`}
            aria-pressed={isSaved} onClick={(e) => {
              e.stopPropagation()
              if (!isSaved) track('destination_saved', { slug: d.slug })
              toggleSaved(d.slug)
            }}>{isSaved ? '♥' : '♡'}</button>
          <button type="button" className={`wk-compare-button${inCompare ? ' is-added' : ''}`}
            aria-label={inCompare ? `Remove ${d.name} from compare` : `Compare ${d.name}`}
            aria-pressed={inCompare} disabled={limitReached}
            title={limitReached ? 'Compare up to 3 places. Remove one to add another.' : undefined}
            onClick={(e) => {
              e.stopPropagation()
              if (!inCompare) track('compare_added', { slug: d.slug, compare_count: compareList.length + 1 })
              toggleCompare(d.slug)
            }}>{inCompare ? '✓ Added' : '+ Compare'}</button>
        </div>
      </div>
    </article>
  )
}
