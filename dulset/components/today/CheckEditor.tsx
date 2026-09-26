'use client'

import { useId, useRef, useState } from 'react'
import { Button, Field, Sheet, cx, inputClass, useToast } from '@/components/ui'
import {
  EVIDENCE_LABEL,
  availableSuggestions,
  infoNotes,
  type Evidence,
  type Suggestion,
} from '@/lib/content/supplements'
import { activeItems, addCheckItem, archiveCheckItem, restoreCheckItem } from '@/lib/logic/checks'
import { isSpermSide } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import type { CheckItem, CheckKind } from '@/lib/types'
import { Badge, ExternalLink, KIND_ICON, KIND_LABEL } from './bits'

const KINDS: CheckKind[] = ['supplement', 'medication', 'habit']

const EVIDENCE_TONE: Record<Evidence, 'ok' | 'brand' | 'muted' | 'warn'> = {
  strong: 'ok',
  moderate: 'brand',
  limited: 'muted',
  'not-recommended': 'warn',
}

/** Edit "my" daily checklist: add, archive/restore, and evidence-backed suggestions. */
export default function CheckEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, update, today, me } = useApp()
  const toast = useToast()
  const [label, setLabel] = useState('')
  const [kind, setKind] = useState<CheckKind>('supplement')
  const [note, setNote] = useState('')
  const kindGroup = useId()
  const labelRef = useRef<HTMLInputElement>(null)
  // Archive/restore removes the tapped row; move focus somewhere sensible instead of <body>.
  const listHeadingRef = useRef<HTMLHeadingElement>(null)

  const active = activeItems(state, me.id)
  // One row per archived label (the newest), hidden when an active item has the same label.
  const archived = latestArchivedByLabel(state.checkItems.filter((i) => i.owner === me.id && !i.active)).filter(
    (a) => !active.some((i) => i.label === a.label),
  )
  const role = me.tracksCycle ? 'cycle-owner' : 'partner'
  // Sperm-side items are 'partner' audience anyway; this also hides them for a non-owner '아내'.
  const spermSide = isSpermSide(me)
  const filter = { sperm: spermSide, stage: state.stage }
  // Archived matches are offered under "보관한 항목" instead, so nothing shows twice.
  const suggestions = availableSuggestions(role, [...active, ...archived], filter)
  const notes = infoNotes(role, filter)

  const add = () => {
    const clean = label.trim()
    if (!clean) return
    update((s) => addCheckItem(s, me.id, clean, kind, today, note))
    toast.show(`'${clean}'을(를) 추가했어요`)
    setLabel('')
    setNote('')
    // Keep the keyboard up for adding several in a row (the submit button disables itself).
    labelRef.current?.focus()
  }

  const addSuggestion = (s: Suggestion) => {
    update((st) => addCheckItem(st, me.id, s.label, s.kind, today, s.note))
    toast.show(`'${s.label}'을(를) 추가했어요`)
    listHeadingRef.current?.focus({ preventScroll: true })
  }

  return (
    <Sheet open={open} onClose={onClose} title="나의 체크 항목">
      {/* Current items */}
      <section aria-labelledby={`${kindGroup}-mine`}>
        <h3
          id={`${kindGroup}-mine`}
          ref={listHeadingRef}
          tabIndex={-1}
          className="mb-2 text-xs font-bold text-ink-2 outline-none"
        >
          매일 체크하는 항목 {active.length > 0 ? `(${active.length})` : ''}
        </h3>
        {active.length === 0 ? (
          <p className="rounded-xl bg-surface-2 px-3 py-3 text-xs text-ink-3">아직 없어요. 아래에서 추가해 보세요.</p>
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface">
            {active.map((i) => (
              <li key={i.id} className="flex items-center gap-2 pl-3">
                <span aria-hidden>{KIND_ICON[i.kind]}</span>
                <span className="min-w-0 flex-1 py-2">
                  <span className="block truncate text-sm font-medium text-ink">{i.label}</span>
                  {i.note ? <span className="block truncate text-[11px] text-ink-3">{i.note}</span> : null}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    update((s) => archiveCheckItem(s, i.id, today))
                    toast.show(`'${i.label}'은(는) 보관했어요. 지난 기록은 그대로예요`)
                    listHeadingRef.current?.focus({ preventScroll: true })
                  }}
                  className="min-h-[44px] shrink-0 px-3 text-xs font-semibold text-ink-3 hover:text-period"
                  aria-label={`${i.label} 보관하기`}
                >
                  보관
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Add */}
      <section className="mt-5 rounded-xl2 border border-line bg-surface p-3" aria-label="새 항목 추가">
        <h3 className="mb-2 text-xs font-bold text-ink-2">직접 추가</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
          className="space-y-3"
        >
          <Field label="이름">
            <input
              ref={labelRef}
              className={inputClass}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder={spermSide ? '예: 물 2L 마시기, 일찍 자기' : '예: 엽산, 물 2L 마시기'}
              maxLength={30}
            />
          </Field>
          <div role="group" aria-label="종류" className="grid grid-cols-3 gap-1.5">
            {KINDS.map((k) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={cx(
                  'flex h-11 items-center justify-center gap-1 rounded-xl border text-xs font-semibold transition-colors',
                  kind === k ? 'border-brand bg-brand-soft text-brand-ink' : 'border-line bg-surface text-ink-2 hover:bg-surface-2',
                )}
              >
                <span aria-hidden>{KIND_ICON[k]}</span>
                {KIND_LABEL[k]}
              </button>
            ))}
          </div>
          <Field label="메모 (선택)">
            <input
              className={inputClass}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={spermSide ? '예: 저녁 식후, 30분' : '예: 400µg, 아침 식후'}
              maxLength={30}
            />
          </Field>
          <Button type="submit" full disabled={!label.trim()}>
            추가하기
          </Button>
        </form>
      </section>

      {/* Suggestions */}
      {suggestions.length > 0 ? (
        <section className="mt-5">
          <h3 className="text-xs font-bold text-ink-2">추천 항목</h3>
          <p className="mb-2 mt-0.5 text-[11px] text-ink-3">ⓘ를 누르면 근거를 볼 수 있어요.</p>
          <ul className="space-y-2">
            {suggestions.map((s) => (
              <SuggestionRow key={s.id} s={s} onAdd={() => addSuggestion(s)} />
            ))}
          </ul>
        </section>
      ) : null}

      {notes.length > 0 ? (
        <section className="mt-5">
          <h3 className="mb-2 text-xs font-bold text-ink-2">알아 두면 좋아요</h3>
          <ul className="space-y-2">
            {notes.map((s) => (
              <SuggestionRow key={s.id} s={s} />
            ))}
          </ul>
        </section>
      ) : null}

      {/* Archived */}
      {archived.length > 0 ? (
        <section className="mt-5">
          <h3 className="mb-2 text-xs font-bold text-ink-2">보관한 항목</h3>
          <ul className="divide-y divide-line rounded-xl border border-line bg-surface-2">
            {archived.map((i) => (
              <li key={i.id} className="flex items-center gap-2 pl-3">
                <span aria-hidden className="opacity-60">
                  {KIND_ICON[i.kind]}
                </span>
                <span className="min-w-0 flex-1 truncate py-2 text-sm text-ink-3">{i.label}</span>
                <button
                  type="button"
                  onClick={() => {
                    update((s) => restoreCheckItem(s, i.id))
                    toast.show(`'${i.label}'을(를) 다시 체크해요`)
                    listHeadingRef.current?.focus({ preventScroll: true })
                  }}
                  className="min-h-[44px] shrink-0 px-3 text-xs font-semibold text-brand-ink"
                  aria-label={`${i.label} 다시 쓰기`}
                >
                  다시 쓰기
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="mt-5 text-[11px] leading-relaxed text-ink-3">
        영양제·약은 개인 건강 상태에 따라 달라요. 복용 중인 약이 있거나 궁금한 점이 있으면 의사·약사와 상의해 주세요.
      </p>
    </Sheet>
  )
}

function SuggestionRow({ s, onAdd }: { s: Suggestion; onAdd?: () => void }) {
  const [open, setOpen] = useState(false)
  const detailId = useId()
  return (
    <li className="rounded-xl border border-line bg-surface">
      <div className="flex items-center gap-2 pl-3">
        <span aria-hidden>{s.infoOnly ? 'ℹ️' : KIND_ICON[s.kind]}</span>
        <span className="min-w-0 flex-1 py-2">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="text-sm font-medium text-ink">{s.label}</span>
            <Badge tone={EVIDENCE_TONE[s.evidence]}>{EVIDENCE_LABEL[s.evidence]}</Badge>
          </span>
          {s.note ? <span className="block truncate text-[11px] text-ink-3">{s.note}</span> : null}
        </span>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={open ? detailId : undefined}
          aria-label={`${s.label} 근거 ${open ? '접기' : '보기'}`}
          className={cx(
            'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base',
            open ? 'text-brand' : 'text-ink-3 hover:text-ink-2',
          )}
        >
          ⓘ
        </button>
        {onAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className="mr-1 flex min-h-[44px] shrink-0 items-center rounded-xl px-3 text-xs font-bold text-brand-ink hover:bg-brand-soft"
            aria-label={`${s.label} 추가`}
          >
            + 추가
          </button>
        ) : null}
      </div>
      {open ? (
        <div id={detailId} className="border-t border-line px-3 pb-1 pt-2">
          <p className="text-xs leading-relaxed text-ink-2">{s.summary}</p>
          <ExternalLink href={s.source.url}>{s.source.name}</ExternalLink>
        </div>
      ) : null}
    </li>
  )
}

function latestArchivedByLabel(items: CheckItem[]): CheckItem[] {
  const byLabel = new Map<string, CheckItem>()
  for (const i of items) {
    const prev = byLabel.get(i.label)
    if (!prev || (i.archivedAt ?? '') > (prev.archivedAt ?? '')) byLabel.set(i.label, i)
  }
  return Array.from(byLabel.values())
}
