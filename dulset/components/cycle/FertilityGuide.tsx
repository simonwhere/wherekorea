'use client'

import { Card, SectionTitle } from '@/components/ui'
import { Icon, type IconName } from '@/components/ui/icons'
import { GUIDE_CHECKED_AT, doctorAgeLine, guideSections, guideSources } from '@/lib/content/fertility'
import { formatKo } from '@/lib/dates'
import { openLHHowTo } from '@/lib/logLauncher'
import type { FertilityView } from '@/lib/logic/calendarView'

/** lib/content/fertility keeps an emoji per section for text; the screen draws a line icon. */
const GUIDE_ICON: Record<string, IconName> = {
  'calendar-limits': 'ruler',
  lh: 'flask',
  frequency: 'heart',
  signs: 'drop',
  doctor: 'steth',
}

export default function FertilityGuide({
  view,
  ownerName,
  ownerAge,
  owner = true,
}: {
  view: FertilityView
  ownerName: string
  ownerAge?: number
  /** The cycle owner's own tab. The partner's leaves out '얼마나 자주면 될까요?'. */
  owner?: boolean
}) {
  // The soft view promises "건강 용어 없이", so it gets the same set as the hidden
  // view (no 가임기/배란 or LH timing sections).
  const hidden = view !== 'explicit'
  // The frequency section ('하루나 이틀에 한 번', '2~3일에 한 번') is hers to read in her own record
  // tool, never put in front of the partner: on his side it reads as a quota (docs/positioning.md §6,
  // the same rule as CycleSummary's NICE card).
  const sections = guideSections(hidden).filter((s) => owner || s.id !== 'frequency')
  const sources = guideSources(sections)

  return (
    <>
      <SectionTitle sub={hidden ? '날짜를 맞추지 않아도 괜찮아요' : '달력 예측을 보완하는 방법이에요'}>
        {hidden ? '편하게 준비하기' : '정확도 높이기'}
      </SectionTitle>
      <Card className="px-0 py-0">
        <ul className="divide-y divide-line">
          {sections.map((s) => (
            <li key={s.id}>
              <details className="group">
                <summary className="flex min-h-[56px] cursor-pointer list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                  <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
                    <Icon name={GUIDE_ICON[s.id] ?? 'info'} className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">
                      {view === 'soft' && s.softTitle ? s.softTitle : s.title}
                    </span>
                    <span className="block text-xs text-ink-3">{s.summary}</span>
                  </span>
                  <Icon name="chev" className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" strokeWidth={2.2} />
                </summary>
                <div className="px-4 pb-4">
                  <ul className="space-y-1.5 pl-1">
                    {s.id === 'doctor' && ownerAge !== undefined && ownerAge >= 15 && ownerAge <= 60 ? (
                      <li className="flex gap-2 rounded-lg bg-brand-soft px-2.5 py-1.5 text-[13px] font-medium leading-relaxed text-brand-ink">
                        {doctorAgeLine(ownerName, ownerAge)}
                      </li>
                    ) : null}
                    {s.points.map((p) => (
                      <li key={p} className="flex gap-2 text-[13px] leading-relaxed text-ink-2">
                        <span aria-hidden className="text-ink-3">
                          ·
                        </span>
                        <span>{p}</span>
                      </li>
                    ))}
                  </ul>
                  {/* The one-page how-to (LHHowTo, N17): start day, time of day, reading, where to buy. */}
                  {s.id === 'lh' ? (
                    <button
                      type="button"
                      onClick={openLHHowTo}
                      className="mt-1 inline-flex min-h-[44px] items-center gap-0.5 text-[13px] font-bold text-brand-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      어떻게 해요?
                      <Icon name="right" className="h-3.5 w-3.5" strokeWidth={2.2} />
                    </button>
                  ) : null}
                  {/* Each source is a 44px-tall link in its own row of the wrap (the same list, in full, sits under 근거 보기). */}
                  <p className="-mb-2 mt-1 flex flex-wrap items-center gap-x-1 text-[11px] text-ink-3">
                    <span className="mr-1">출처:</span>
                    {s.sources.map((src, i) => (
                      <span key={src.url} className="inline-flex items-center">
                        {i > 0 ? <span aria-hidden>, </span> : null}
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-[44px] items-center underline underline-offset-2"
                        >
                          {src.name}
                        </a>
                      </span>
                    ))}
                  </p>
                </div>
              </details>
            </li>
          ))}
          <li>
            <details className="group">
              <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between px-4 text-xs font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
                근거 보기 ({sources.length})
                <Icon name="chev" className="h-4 w-4 shrink-0 text-ink-3 transition-transform group-open:rotate-180" strokeWidth={2.2} />
              </summary>
              <ol className="px-4 pb-4">
                {sources.map((src) => (
                  <li key={src.url} className="text-xs leading-relaxed">
                    {/* 44px tall rows: the link is the whole line, the note sits beside it. */}
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[44px] items-center font-medium text-brand-ink underline underline-offset-2"
                    >
                      {src.name}
                    </a>
                    {src.note ? <span className="ml-1 text-ink-3">— {src.note}</span> : null}
                  </li>
                ))}
                <li className="pt-1 text-[11px] leading-relaxed text-ink-3">
                  수치는 논문·가이드라인 요약을 옮긴 거예요. 둘셋은 의료기기가 아니며 진단이나 피임에 쓸 수 없어요. 확인일{' '}
                  {formatKo(GUIDE_CHECKED_AT, { weekday: false, year: true })}.
                </li>
              </ol>
            </details>
          </li>
        </ul>
      </Card>
    </>
  )
}
