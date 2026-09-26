'use client'

import { useCallback, useState } from 'react'
import { Button, Card, EmptyState, SectionTitle, cx, useToast } from '@/components/ui'
import { GROWTH_CHART_LINK, GROWTH_LIMITS, type GrowthField } from '@/lib/content/baby'
import { formatKo } from '@/lib/dates'
import { removeGrowth } from '@/lib/logic/baby'
import { GROWTH_FIELDS, ageAt, formatMeasure, growthNewestFirst, growthSeries } from '@/lib/logic/babyView'
import { useApp } from '@/lib/store'
import type { Baby, GrowthRecord } from '@/lib/types'
import { ExternalLink } from './bits'
import GrowthChart from './GrowthChart'
import GrowthSheet from './GrowthSheet'

const LIST_PREVIEW = 4

/** Short row labels — kg already says 몸무게. */
const ROW_PREFIX: Record<GrowthField, string> = { weightKg: '', heightCm: '키 ', headCm: '머리 ' }

export default function GrowthSection({ baby }: { baby: Baby }) {
  const { state, today } = useApp()
  const [addOpen, setAddOpen] = useState(false)
  const closeAdd = useCallback(() => setAddOpen(false), [])
  const [field, setField] = useState<GrowthField>('weightKg')
  const [showAll, setShowAll] = useState(false)
  const birth = baby.birthDate
  const canAdd = birth <= today

  const series = Object.fromEntries(GROWTH_FIELDS.map((f) => [f, growthSeries(state.growth, birth, f)])) as Record<
    GrowthField,
    ReturnType<typeof growthSeries>
  >
  const available = GROWTH_FIELDS.filter((f) => series[f].length > 0)
  const current = available.includes(field) ? field : available[0]
  const list = growthNewestFirst(state.growth)
  const visible = showAll ? list : list.slice(0, LIST_PREVIEW)

  return (
    <section>
      <SectionTitle
        sub="검진이나 병원에서 잰 값을 옮겨 적어요"
        action={
          <Button size="md" variant="secondary" onClick={() => setAddOpen(true)} disabled={!canAdd}>
            + 기록
          </Button>
        }
      >
        성장 기록
      </SectionTitle>

      {list.length === 0 ? (
        <EmptyState
          icon="📏"
          title="첫 성장 기록을 남겨 볼까요?"
          body="키·몸무게·머리둘레 중 잰 것만 적어도 돼요. 쌓이면 그래프로 보여 드려요."
          action={
            <Button onClick={() => setAddOpen(true)} disabled={!canAdd}>
              기록 추가
            </Button>
          }
        />
      ) : (
        <Card>
          {current ? (
            <>
              <div className="-mx-1 -mt-1 mb-2 flex gap-1" role="group" aria-label="그래프 항목">
                {available.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={f === current}
                    onClick={() => setField(f)}
                    className={cx(
                      'h-11 min-w-[44px] rounded-xl px-3 text-sm font-semibold transition-colors',
                      f === current ? 'bg-brand-soft text-brand-ink' : 'text-ink-3 hover:bg-surface-2',
                    )}
                  >
                    {GROWTH_LIMITS[f].label}
                  </button>
                ))}
              </div>
              <GrowthChart
                key={`${current}:${series[current].length}`}
                points={series[current]}
                field={current}
                birth={birth}
              />
              <p className="mt-1 text-[11px] text-ink-3">가로축: 생후 개월 수 · 그래프를 눌러 기록별 값을 볼 수 있어요</p>
            </>
          ) : (
            <p className="text-xs text-ink-3">태어난 날 이후의 기록이 쌓이면 그래프가 보여요.</p>
          )}

          <h3 className="mt-4 text-xs font-semibold text-ink-2">
            기록 <span className="font-normal text-ink-3">{list.length}개</span>
          </h3>
          <ul className="mt-1">
            {visible.map((g) => (
              <GrowthRow key={g.id} record={g} birth={birth} />
            ))}
          </ul>
          {list.length > LIST_PREVIEW ? (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              className="mt-1 flex min-h-[44px] w-full items-center justify-center text-xs font-semibold text-ink-2 hover:text-ink"
            >
              {showAll ? '접기' : `전체 ${list.length}개 보기`}
            </button>
          ) : null}
        </Card>
      )}

      <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-3">
        이 그래프는 기록을 이어 본 것이라 또래 비교(백분위)는 보여 주지 않아요.{' '}
        <ExternalLink href={GROWTH_CHART_LINK.url} className="font-semibold text-brand-ink underline underline-offset-2">
          {GROWTH_CHART_LINK.text}
        </ExternalLink>
      </p>

      <GrowthSheet open={addOpen} onClose={closeAdd} birth={birth} />
    </section>
  )
}

function GrowthRow({ record, birth }: { record: GrowthRecord; birth: string }) {
  const { update } = useApp()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const values = GROWTH_FIELDS.flatMap((f) => {
    const v = record[f]
    return typeof v === 'number' ? [`${ROW_PREFIX[f]}${formatMeasure(v, f)}`] : []
  })
  const when = formatKo(record.date, { year: true, weekday: false })

  if (confirming) {
    return (
      <li className="flex min-h-[52px] items-center justify-between gap-2 border-t border-line/60 py-1 first:border-t-0">
        <p className="text-sm text-ink">
          {when} 기록을 지울까요?
        </p>
        <div className="flex shrink-0 gap-1">
          <Button variant="ghost" onClick={() => setConfirming(false)}>
            취소
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              update((s) => removeGrowth(s, record.id))
              toast.show('기록을 지웠어요')
            }}
          >
            지우기
          </Button>
        </div>
      </li>
    )
  }

  return (
    <li className="flex min-h-[52px] items-center gap-2 border-t border-line/60 py-1 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink">{values.join(' · ')}</p>
        <p className="text-[11px] text-ink-3">
          {when}
          {record.date >= birth ? ` · ${ageAt(birth, record.date)}` : ''}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`${when} 성장 기록 삭제`}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink-2"
      >
        <span aria-hidden>🗑️</span>
      </button>
    </li>
  )
}
