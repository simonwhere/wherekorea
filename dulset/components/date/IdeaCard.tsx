'use client'

import { cx } from '@/components/ui'
import {
  BUDGET_META,
  CATEGORY_META,
  FLAG_BADGE,
  SEASON_LABEL,
  type DateIdea,
  type Season,
} from '@/lib/content/dateIdeas'
import { formatKo } from '@/lib/dates'
import { ideaTip, mapLinks, seasonFit, seasonOf, visibleFlags } from '@/lib/logic/dateIdeas'
import { useApp } from '@/lib/store'
import type { ISODate } from '@/lib/types'

const SEASON_EMOJI: Record<Season, string> = {
  spring: '🌸',
  summer: '🌊',
  fall: '🍂',
  winter: '❄️',
}

const actionBase =
  'inline-flex min-h-[44px] items-center justify-center gap-1 rounded-xl px-2 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

/**
 * A date idea. `featured` (이번 주 추천) also shows why it's good and stacks the
 * actions for the narrower carousel card.
 */
export default function IdeaCard({
  idea,
  featured,
  onPlan,
  plannedOn,
  className,
}: {
  idea: DateIdea
  featured?: boolean
  onPlan: (idea: DateIdea) => void
  /** Date of an upcoming plan made from this idea, if any. */
  plannedOn?: ISODate
  className?: string
}) {
  const { state, today } = useApp()
  const stage = state.stage
  const season = seasonOf(today)
  const fit = seasonFit(idea, season)
  const flags = visibleFlags(idea, stage)
  const tip = ideaTip(idea, stage)
  const links = mapLinks(idea.mapQuery)
  const budget = BUDGET_META[idea.budget]

  return (
    <article
      className={cx(
        // relative: keeps the sr-only text inside the card (and the carousel's scroll clip).
        'relative flex flex-col rounded-xl2 border border-line bg-surface p-4 shadow-card',
        featured && 'h-full',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-2xl"
        >
          {idea.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold leading-snug text-ink">{idea.title}</h3>
          <p className="mt-0.5 text-[11px] text-ink-3">
            {CATEGORY_META[idea.category].label} ·{' '}
            <span aria-hidden className="font-semibold text-ink-2">
              {budget.symbol}
            </span>
            <span className="sr-only">예산 {budget.label}</span> · {idea.duration}
          </p>
        </div>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-ink-2">{idea.description}</p>
      {featured ? <p className="mt-1 text-xs leading-relaxed text-ink-3">💞 {idea.why}</p> : null}

      {/* The list is already sorted in-season first, so the season badge is for the featured cards only. */}
      {plannedOn || flags.length > 0 || fit === 'out' || (featured && fit === 'in') ? (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label="특징">
          {plannedOn ? (
            <li className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-semibold text-white">
              📅 {formatKo(plannedOn, { weekday: false })} 일정에 있어요
            </li>
          ) : null}
          {featured && fit === 'in' ? (
            <li className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand-ink">
              {SEASON_EMOJI[season]} 지금 딱 좋은 계절
            </li>
          ) : null}
          {fit === 'out' && idea.seasons ? (
            <li className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-ink-3">
              {idea.seasons.map((s) => SEASON_LABEL[s]).join('·')} 추천
            </li>
          ) : null}
          {flags.map((f) => (
            <li
              key={f}
              className={cx(
                'rounded-full px-2 py-0.5 text-[11px] font-medium',
                f === 'no-alcohol' || f === 'no-heat' ? 'bg-ok-soft text-ok' : 'bg-surface-2 text-ink-2',
              )}
            >
              {FLAG_BADGE[f]}
            </li>
          ))}
        </ul>
      ) : null}

      {tip ? (
        <p className="mt-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[11px] leading-relaxed text-ink-2">
          <span aria-hidden>💡 </span>
          {tip}
        </p>
      ) : null}

      <div className={cx(featured ? 'mt-auto pt-3' : 'mt-3')}>
        <p className="mb-1 truncate text-[11px] text-ink-3">
          <span aria-hidden>📍 </span>지도에서 찾기 · ‘{idea.mapQuery}’
        </p>
        <div className={cx('grid gap-1.5', featured ? 'grid-cols-2' : 'grid-cols-3')}>
          <a
            href={links.kakao}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${idea.title}: 카카오맵에서 찾기 (새 창)`}
            className={cx(actionBase, 'bg-surface-2 text-ink-2 hover:bg-line/60')}
          >
            카카오맵
            <span aria-hidden className="text-[10px] text-ink-3">
              ↗
            </span>
          </a>
          <a
            href={links.naver}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${idea.title}: 네이버지도에서 찾기 (새 창)`}
            className={cx(actionBase, 'bg-surface-2 text-ink-2 hover:bg-line/60')}
          >
            네이버지도
            <span aria-hidden className="text-[10px] text-ink-3">
              ↗
            </span>
          </a>
          <button
            type="button"
            onClick={() => onPlan(idea)}
            aria-label={`${idea.title} 일정에 담기`}
            className={cx(actionBase, 'bg-brand text-white hover:bg-brand/90', featured && 'col-span-2')}
          >
            일정에 담기
          </button>
        </div>
      </div>
    </article>
  )
}
