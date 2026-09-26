'use client'

import { Toggle, cx } from '@/components/ui'
import { NICE_GUIDANCE } from '@/lib/content/fertility'
import { draftNames, draftOwner, draftRoles, draftStyles, sampleWindow, type OnboardingDraft } from '@/lib/demo'
import { ROLE_EMOJI } from '@/lib/initial'
import { ALERT_STYLE_OPTIONS, alertPreview } from '@/lib/logic/settings'
import type { AlertStyle, ISODate, MemberId } from '@/lib/types'
import { ChoiceGroup, NoticePreview, SourceLink, type Option } from './parts'

// The same names as 설정 › 알림 (and the 오늘/달력 notes that quote them).
const STYLE_OPTIONS: Option<AlertStyle>[] = ALERT_STYLE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))

export default function AlertStep({
  draft,
  patch,
  today,
}: {
  draft: OnboardingDraft
  patch: (p: Partial<OnboardingDraft>) => void
  today: ISODate
}) {
  const names = draftNames(draft)
  const roles = draftRoles(draft)
  const owner = draftOwner(draft)
  const styles = draftStyles(draft)
  const w = draft.periodUnknown ? null : sampleWindow(draft.lastPeriodStart, draft.cycleLength, draft.periodLength, today)
  const low = draft.lowPressure

  const setStyle = (id: MemberId, style: AlertStyle) => patch({ alertStyle: { ...draft.alertStyle, [id]: style } })

  return (
    <div className="space-y-4">
      {(['a', 'b'] as const).map((id) => {
        const style = styles[id]
        const isOwner = id === owner
        const p = alertPreview(style, { lowPressure: low, isCycleOwner: isOwner, window: w ?? undefined })
        const role = roles[id]
        return (
          <section
            key={id}
            aria-label={`${names[id]} 알림 방식`}
            className="rounded-xl2 border border-line bg-surface p-4 shadow-card"
          >
            <div className="mb-3 flex items-center gap-2">
              <span
                aria-hidden
                className={cx(
                  'flex h-9 w-9 items-center justify-center rounded-full text-lg',
                  isOwner ? 'bg-her-soft' : 'bg-him-soft',
                )}
              >
                {role ? ROLE_EMOJI[role] : '🙂'}
              </span>
              <p className="min-w-0 flex-1 truncate text-sm font-bold text-ink">
                {names[id]}
                {id === 'a' ? <span className="font-medium text-ink-3"> (나)</span> : null}
              </p>
              {isOwner ? (
                <span className="shrink-0 rounded-full bg-period-soft px-2 py-0.5 text-[11px] font-semibold text-period">
                  주기 기록
                </span>
              ) : null}
            </div>
            <ChoiceGroup
              label={`${names[id]}의 가임기 알림 방식`}
              options={STYLE_OPTIONS}
              columns={1}
              value={style}
              onChange={(s) => setStyle(id, s)}
              disabled={low}
            />
            {low ? (
              <p className="mt-2 text-xs text-ink-3">‘부담 없이 모드’를 켜 두어서 지금은 적용되지 않아요.</p>
            ) : (
              <div className="mt-3 space-y-2">
                <p className="text-xs leading-relaxed text-ink-2">{p.note}</p>
                {p.message ? <NoticePreview title={p.message.title} body={p.message.body} /> : null}
              </div>
            )}
          </section>
        )
      })}

      <p className="px-1 text-xs leading-relaxed text-ink-3">
        {names.b}님은 연결한 뒤 직접 바꿀 수 있어요. 잠금화면에 내용이 보이지 않게 하는 설정도 있어요.
      </p>

      <section aria-label="부담 없이 모드" className="rounded-xl2 border border-brand/20 bg-brand-soft p-4 shadow-card">
        <Toggle
          checked={low}
          onChange={(lowPressure) => patch({ lowPressure })}
          label="부담 없이 모드"
          description="날짜를 맞추기보다, 주기 내내 2~3일에 한 번 편하게 함께하면 충분하다는 안내(NICE 2026)를 따라요. 켜면 두 사람 모두 가임기 알림과 카운트다운 없이, 둘만의 시간으로만 안내해요. 나중에 설정에서도 바꿀 수 있어요."
        />
        <p aria-live="polite" className="text-xs leading-relaxed text-ink-2">
          {low ? '켜 두었어요. 체크·응원 알림은 그대로 와요.' : ''}
        </p>
        <SourceLink href={NICE_GUIDANCE.source.url}>출처: {NICE_GUIDANCE.source.name}</SourceLink>
      </section>
    </div>
  )
}
