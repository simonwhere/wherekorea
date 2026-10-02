'use client'

// 난임 시술 회차 (Next B — B2): add or edit one attempt. The cycle owner's
// sheet (lib/logic/treatments canEditTreatments); every change goes through
// addTreatment / updateTreatment / removeTreatment, which clean the fields the
// way a backup is cleaned. Only what the couple logged is kept — nothing here
// predicts, scores or reads a result. The kind labels follow the viewer's
// lens (neutralTreatmentWords), so a soft / off viewer never meets '배란'.

import { useEffect, useId, useRef, useState } from 'react'
import { ChoiceChips, FieldError, btnDanger, btnGhost, btnSecondary } from '@/components/plan/bits'
import { Button, Field, Sheet, inputClass, textareaClass, useToast } from '@/components/ui'
import { formatKo, isISODate } from '@/lib/dates'
import {
  NOTICE_VALID_MONTHS,
  NOTICE_VALID_MONTHS_FROM,
  OUTCOME_LABEL,
  TREATMENT_NOTE_MAX,
  addTreatment,
  neutralTreatmentWords,
  noticeExpiryFrom,
  removeTreatment,
  treatmentLabel,
  updateTreatment,
} from '@/lib/logic/treatments'
import { useApp } from '@/lib/store'
import { TREATMENT_KINDS, type Treatment, type TreatmentKind, type TreatmentOutcome } from '@/lib/types'

type Supported = 'yes' | 'no' | 'unknown'
type Outcome = TreatmentOutcome | 'none'
type Err = 'start' | 'end' | 'notice'

const OUTCOMES: readonly TreatmentOutcome[] = ['ongoing', 'negative', 'positive', 'cancelled']

const ERROR_TEXT: Record<Err, string> = {
  start: '시작한 날을 다시 확인해 주세요.',
  end: '끝난 날은 시작한 날 뒤여야 해요.',
  notice: '통지서 만료일을 다시 확인해 주세요.',
}

/** What each kind means for the counter (no number that isn't in treatments.ts). */
const KIND_HINT: Record<TreatmentKind, string> = {
  'ovulation-induction': '약·주사만 쓴 주기예요. 지원 횟수에는 들어가지 않아요.',
  iui: '인공수정 회차예요. 지원 회차면 인공수정 횟수에 세요.',
  'ivf-fresh': '신선배아 이식이에요. 동결배아와 함께 체외수정 횟수에 세요.',
  'ivf-frozen': '동결배아 이식이에요. 신선배아와 함께 체외수정 횟수에 세요.',
}

export default function TreatmentSheet({ editing, onClose }: { editing?: Treatment; onClose: () => void }) {
  const { state, update, today, viewer, partner } = useApp()
  const toast = useToast()
  const errorId = useId()
  const neutral = neutralTreatmentWords(state.settings, viewer)
  const [kind, setKind] = useState<TreatmentKind>(editing?.kind ?? 'iui')
  const [start, setStart] = useState(editing?.startDate ?? today)
  const [end, setEnd] = useState(editing?.endDate ?? '')
  const [outcome, setOutcome] = useState<Outcome>(editing?.outcome ?? 'none')
  const [supported, setSupported] = useState<Supported>(
    editing?.supported === true ? 'yes' : editing?.supported === false ? 'no' : 'unknown',
  )
  const [notice, setNotice] = useState(editing?.noticeExpires ?? '')
  const [issued, setIssued] = useState('')
  const [note, setNote] = useState(editing?.note ?? '')
  const [error, setError] = useState<Err | null>(null)
  const [confirming, setConfirming] = useState(false)
  const deleteRef = useRef<HTMLButtonElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const returnFocus = useRef(false)

  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
    else if (returnFocus.current) {
      returnFocus.current = false
      deleteRef.current?.focus()
    }
  }, [confirming])

  const describe = (key: Err) => (error === key ? `${errorId}-${key}` : undefined)

  /** 발급일 → the last valid day (6개월 from 2026-01, 3개월 before); the date on the paper wins. */
  const onIssued = (v: string) => {
    setIssued(v)
    const expiry = isISODate(v) ? noticeExpiryFrom(v) : undefined
    if (expiry) {
      setNotice(expiry)
      if (error === 'notice') setError(null)
    }
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!isISODate(start)) return setError('start')
    if (end && (!isISODate(end) || end < start)) return setError('end')
    if (notice && !isISODate(notice)) return setError('notice')
    setError(null)
    const fields = {
      kind,
      startDate: start,
      endDate: end || undefined,
      outcome: outcome === 'none' ? undefined : outcome,
      supported: supported === 'unknown' ? undefined : supported === 'yes',
      noticeExpires: notice || undefined,
      note: note.trim() || undefined,
    }
    if (editing) {
      update((s) => updateTreatment(s, editing.id, fields))
      toast.show('회차를 고쳤어요')
    } else {
      update((s) => addTreatment(s, fields))
      toast.show(`회차를 기록했어요 · ${partner.name}님 화면에도 보여요`)
    }
    onClose()
  }

  const remove = () => {
    if (!editing) return
    update((s) => removeTreatment(s, editing.id))
    toast.show('회차를 지웠어요')
    onClose()
  }

  return (
    <Sheet open onClose={onClose} title={editing ? '회차 고치기' : '회차 기록'}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-ink-2">어떤 시술</span>
          <ChoiceChips<TreatmentKind>
            label="어떤 시술"
            value={kind}
            onChange={setKind}
            options={TREATMENT_KINDS.map((k) => ({ value: k, label: treatmentLabel(k, neutral) }))}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">{KIND_HINT[kind]}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="시작한 날">
            <input
              type="date"
              className={inputClass}
              value={start}
              required
              aria-invalid={error === 'start'}
              aria-describedby={describe('start')}
              onChange={(e) => {
                setStart(e.target.value)
                if (error === 'start') setError(null)
              }}
            />
          </Field>
          <Field label="끝난 날 (선택)">
            <input
              type="date"
              className={inputClass}
              value={end}
              min={isISODate(start) ? start : undefined}
              aria-invalid={error === 'end'}
              aria-describedby={describe('end')}
              onChange={(e) => {
                setEnd(e.target.value)
                if (error === 'end') setError(null)
              }}
            />
          </Field>
        </div>
        {error === 'start' || error === 'end' ? <FieldError id={`${errorId}-${error}`}>{ERROR_TEXT[error]}</FieldError> : null}
        <p className="-mt-2 text-[11px] leading-relaxed text-ink-3">시작은 약·채취·이식 중 둘이 정한 날, 끝은 결과를 안 날이에요.</p>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-ink-2">결과</span>
          <ChoiceChips<Outcome>
            label="결과"
            value={outcome}
            onChange={setOutcome}
            options={[{ value: 'none', label: '아직 없음' }, ...OUTCOMES.map((o) => ({ value: o, label: OUTCOME_LABEL[o] }))]}
          />
        </div>

        <div>
          <span className="mb-1.5 block text-xs font-semibold text-ink-2">정부 지원</span>
          <ChoiceChips<Supported>
            label="정부 지원"
            value={supported}
            onChange={setSupported}
            options={[
              { value: 'yes', label: '지원 회차' },
              { value: 'no', label: '본인 부담' },
              { value: 'unknown', label: '아직 몰라요' },
            ]}
          />
          <p className="mt-1.5 text-[11px] leading-relaxed text-ink-3">지원 회차만 횟수에 세요. 중단한 회차는 세지 않아요 · 보건소마다 달라요.</p>
        </div>

        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-xs font-semibold text-ink">지원결정통지서 (선택)</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <Field label="유효기간 끝">
              <input
                type="date"
                className={inputClass}
                value={notice}
                aria-invalid={error === 'notice'}
                aria-describedby={describe('notice')}
                onChange={(e) => {
                  setNotice(e.target.value)
                  if (error === 'notice') setError(null)
                }}
              />
            </Field>
            <Field label="발급일로 계산">
              <input type="date" className={inputClass} value={issued} onChange={(e) => onIssued(e.target.value)} />
            </Field>
          </div>
          {error === 'notice' ? (
            <div className="mt-2">
              <FieldError id={`${errorId}-notice`}>{ERROR_TEXT.notice}</FieldError>
            </div>
          ) : null}
          <p className="mt-2 text-[11px] leading-relaxed text-ink-3">
            {isISODate(notice) ? `${formatKo(notice, { year: true })}까지예요. ` : ''}
            만료일을 적어 두면 30일 · 7일 · 1일 전에 둘 다에게 알려 줘요. 발급일만 알면 {NOTICE_VALID_MONTHS_FROM.slice(0, 4)}년부터{' '}
            {NOTICE_VALID_MONTHS.from}개월(그 전엔 {NOTICE_VALID_MONTHS.before}개월)로 계산해요 — 통지서에 적힌 날짜가 우선이에요.
          </p>
        </div>

        <Field label="메모 (선택)">
          <textarea
            className={textareaClass}
            rows={2}
            value={note}
            maxLength={TREATMENT_NOTE_MAX}
            placeholder="예: 병원 이름, 다음에 물어볼 것"
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>

        <Button type="submit" full size="lg">
          {editing ? '저장' : '기록하기'}
        </Button>

        {editing && !confirming ? (
          <button ref={deleteRef} type="button" onClick={() => setConfirming(true)} className={`${btnGhost} w-full`}>
            이 회차 지우기
          </button>
        ) : null}
        {confirming ? (
          <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label="회차 지우기 확인">
            <span className="text-xs text-ink-2">이 회차를 지울까요?</span>
            <button type="button" className={btnDanger} onClick={remove}>
              지우기
            </button>
            <button
              ref={cancelRef}
              type="button"
              className={btnSecondary}
              onClick={() => {
                returnFocus.current = true
                setConfirming(false)
              }}
            >
              취소
            </button>
          </div>
        ) : null}
      </form>
    </Sheet>
  )
}
