'use client'

// 난임 시술 · 지원 (Next B — B2): the counter card at the top of 챙길 것 while
// 병원과 함께 준비 중 (lib/logic/treatments showsTreatmentCounter). It counts
// what the couple logged — 지원 회차 N/5 · N/20 · N/25 (denominators only
// while treatments.ts says they are verified, else 'N회 사용 · 보건소에서
// 확인해요' with a link), the 지원결정통지서 D-N, and each person's
// 난임치료휴가 N/6일 · 유급 M일. Amounts nobody verified (회당 상한, 사실혼)
// are a link, never a number. The cycle owner logs attempts; the partner sees
// the counts, and of each row only what canSeeCycleDetails allows (no end
// date — often a period — and no result without the share consent). A soft /
// off / 부담 줄이기 viewer gets the neutral kind labels.

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import LeaveSheet from '@/components/clinic/LeaveSheet'
import TreatmentSheet from '@/components/clinic/TreatmentSheet'
import { takeOpenTreatments } from '@/components/clinic/openTreatments'
import { ExternalLink, Pill, btnBrand } from '@/components/plan/bits'
import { Card, Disclaimer, cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { programById } from '@/lib/content/programs'
import { formatKo } from '@/lib/dates'
import { canSeeCycleDetails } from '@/lib/logic/prefs'
import {
  OUTCOME_LABEL,
  SUPPORT_SOURCE,
  canEditTreatments,
  leavePaidLine,
  leaveSummary,
  leaveUsedLabel,
  neutralTreatmentWords,
  noticeLine,
  noticeStatus,
  ovulationInductionLabel,
  supportCounts,
  supportUsedLabel,
  treatmentLabel,
  treatmentWhen,
  treatmentsOf,
  type SupportCount,
} from '@/lib/logic/treatments'
import { useApp } from '@/lib/store'
import type { Treatment } from '@/lib/types'

export const TREATMENTS_CARD_TITLE = '난임 시술 · 지원'

type SheetState = { editing?: Treatment } | null

function Counter({ label, count }: { label: string; count: SupportCount }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2.5 py-2">
      <dt className="text-[11px] font-medium text-ink-3">{label}</dt>
      <dd className="mt-0.5 text-base font-bold tabular-nums text-ink">
        {count.used}
        <span className="text-xs font-semibold text-ink-3">/{count.total}회</span>
      </dd>
    </div>
  )
}

export default function TreatmentsCard() {
  const { state, today, viewer, cycleOwner } = useApp()
  const [sheet, setSheet] = useState<SheetState>(null)
  const [leaveOpen, setLeaveOpen] = useState(false)
  const closeSheet = useCallback(() => setSheet(null), [])
  const closeLeave = useCallback(() => setLeaveOpen(false), [])
  const headingRef = useRef<HTMLHeadingElement>(null)
  // The card leads with the counts and the notice; the rows, the leave days and
  // the sources sit behind one fold so 이번 주 챙길 것 stays near the top on a
  // 375×667 phone (B2 open issue). The home card's hand-off opens the fold.
  const [open, setOpen] = useState(false)
  const detailId = useId()
  // The clinic-mode home card asks for this card (openTreatments): focus the heading once.
  useEffect(() => {
    if (takeOpenTreatments()) {
      setOpen(true)
      headingRef.current?.focus()
    }
  }, [])

  const counts = supportCounts(state)
  const notice = noticeStatus(state, today)
  const list = [...treatmentsOf(state)].reverse()
  const neutral = neutralTreatmentWords(state.settings, viewer)
  const details = canSeeCycleDetails(state, viewer)
  const canEdit = canEditTreatments(state, viewer)
  const members = state.couple.members
  const program = programById('infertility')
  const leaveProgram = programById('infertility-leave')
  const unverified = counts.all.denominatorUnknown
  const year = leaveSummary(state, members[0].id, today).year
  const paid = leavePaidLine(leaveSummary(state, members[0].id, today))

  return (
    <Card className="mb-4" aria-labelledby="treatments-card-title">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="treatments-card-title" ref={headingRef} tabIndex={-1} className="text-[15px] font-bold text-ink outline-none">
            {TREATMENTS_CARD_TITLE}
          </h2>
          <p className="mt-0.5 text-xs text-ink-3">기록한 회차 기준 · 출산당 · 보건소마다 달라요</p>
        </div>
        {canEdit ? (
          <button type="button" onClick={() => setSheet({})} className={`${btnBrand} -mr-2 -mt-2 shrink-0`}>
            ＋ 회차
          </button>
        ) : null}
      </div>

      {/* 지원 횟수 — the verified denominators, or the count with a place to check. */}
      {unverified ? (
        <div className="mt-3 rounded-xl bg-surface-2 px-3 py-2.5">
          <p className="text-sm font-semibold text-ink">{supportUsedLabel(counts.all)}</p>
          {program ? (
            <div className="-mb-2">
              <ExternalLink href={program.url}>{program.urlLabel}에서 확인하기</ExternalLink>
            </div>
          ) : null}
        </div>
      ) : (
        <dl className="mt-3 grid grid-cols-3 gap-2">
          <Counter label="인공수정" count={counts.iui} />
          <Counter label="체외수정" count={counts.ivf} />
          <Counter label="합계" count={counts.all} />
        </dl>
      )}
      {counts.ovulationInduction.used > 0 ? (
        <p className="mt-1.5 text-[11px] text-ink-3">
          {treatmentLabel('ovulation-induction', neutral)} {ovulationInductionLabel(counts.ovulationInduction)}
        </p>
      ) : null}
      {counts.since ? (
        <p className="mt-1.5 text-[11px] text-ink-3">{formatKo(counts.since, { year: true })} 출산 뒤 회차부터 다시 세요.</p>
      ) : null}

      {/* 지원결정통지서 */}
      <div className="mt-3 flex items-start gap-2.5 rounded-xl bg-surface-2 px-3 py-2.5">
        <Icon name="doc" className="mt-px h-[18px] w-[18px] shrink-0 text-ink-2" />
        <div className="min-w-0 text-xs leading-relaxed">
          <p className="font-semibold text-ink">지원결정통지서</p>
          <p className="text-ink-2">
            {notice
              ? noticeLine(notice)
              : canEdit
                ? '회차에 만료일을 적어 두면 30일 · 7일 · 1일 전에 둘 다에게 알려 줘요.'
                : '아직 적힌 만료일이 없어요.'}
          </p>
        </div>
      </div>

      <button
        type="button"
        aria-expanded={open}
        aria-controls={detailId}
        onClick={() => setOpen((v) => !v)}
        className="mt-1.5 flex min-h-[44px] w-full items-center justify-between gap-2 rounded-xl px-2 text-left text-xs font-semibold text-ink-2 hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span>{open ? '접기' : `회차 ${list.length}개 · 난임치료휴가 · 출처`}</span>
        <Icon name="chev" className={cx('h-4 w-4 shrink-0 transition-transform', open && 'rotate-180')} strokeWidth={2.2} />
      </button>

      <div id={detailId} hidden={!open}>
        {/* 회차 */}
        {list.length ? (
          <ul className="mt-3 divide-y divide-line/60" aria-label="기록한 회차">
            {list.map((t) => {
              const label = treatmentLabel(t.kind, neutral)
              const row = (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">{label}</p>
                    <p className="mt-0.5 text-[11px] tabular-nums text-ink-3">
                      {/* Dates and results only with the share consent: an attempt's day stands in for her cycle. */}
                      {details ? treatmentWhen(t, today, details) : '기록됨'}
                      {details && t.outcome ? ` · ${OUTCOME_LABEL[t.outcome]}` : ''}
                      {t.noticeExpires && notice?.treatmentId === t.id ? (
                        <>
                          {' · '}
                          <Icon name="doc" className="inline-block h-3 w-3 align-[-1px]" strokeWidth={2} /> 통지서
                        </>
                      ) : null}
                    </p>
                  </div>
                  {t.supported === true ? (
                    <Pill tone="soft">지원</Pill>
                  ) : t.supported === false ? (
                    <Pill tone="muted">본인 부담</Pill>
                  ) : null}
                </>
              )
              return (
                <li key={t.id}>
                  {canEdit ? (
                    <button
                      type="button"
                      onClick={() => setSheet({ editing: t })}
                      aria-label={`${label} ${details ? treatmentWhen(t, today, details) : ''} 회차 고치기`}
                      className="flex min-h-[44px] w-full items-center gap-2 rounded-xl px-1 py-1.5 text-left hover:bg-surface-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                    >
                      {row}
                      <Icon name="right" className="h-4 w-4 shrink-0 text-ink-3" strokeWidth={2} />
                    </button>
                  ) : (
                    <div className="flex min-h-[44px] items-center gap-2 px-1 py-1.5">{row}</div>
                  )}
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-3 text-xs leading-relaxed text-ink-3">
            {canEdit ? '회차를 기록하면 지원 횟수와 통지서 만료일을 여기서 세요.' : `${cycleOwner.name}님이 회차를 기록하면 여기에 보여요.`}
          </p>
        )}

        {/* 난임치료휴가 */}
        <div className="mt-3 border-t border-line/60 pt-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-bold text-ink">난임치료휴가 · {year}년</h3>
            <button type="button" onClick={() => setLeaveOpen(true)} className={`${btnBrand} -mr-2 -my-2`}>
              휴가 날 적기
            </button>
          </div>
          <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-ink-2" aria-label="사람별 난임치료휴가">
            {members.map((m) => (
              <li key={m.id} className="tabular-nums">
                <b className="font-semibold text-ink">{m.name}</b> {leaveUsedLabel(leaveSummary(state, m.id, today))}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] leading-relaxed text-ink-3">사람마다 연 6일 · {paid} · 남성도 쓸 수 있어요 · 회사마다 달라요</p>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4">
          {program ? <ExternalLink href={program.url}>{program.urlLabel}에서 보기</ExternalLink> : null}
          {leaveProgram ? <ExternalLink href={leaveProgram.url}>{leaveProgram.urlLabel}</ExternalLink> : null}
        </div>
        <Disclaimer>
          회당 지원 금액과 사실혼 조건은 정부24·보건소에서 확인해요. 횟수 출처: {SUPPORT_SOURCE.name} (시행 {SUPPORT_SOURCE.effective} ·
          확인 {SUPPORT_SOURCE.checked}).
        </Disclaimer>
      </div>

      {sheet ? <TreatmentSheet key={sheet.editing?.id ?? 'new'} editing={sheet.editing} onClose={closeSheet} /> : null}
      {leaveOpen ? <LeaveSheet onClose={closeLeave} /> : null}
    </Card>
  )
}
