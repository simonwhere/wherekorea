'use client'

import { Card } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { PROGRAMS_CHECKED_AT, programsFor } from '@/lib/content/programs'
import { settingsFor } from '@/lib/logic/prefs'
import { effectiveLabel, formatDot } from '@/lib/logic/settings'
import { fertilityVoice } from '@/lib/logic/today'
import { useApp } from '@/lib/store'
import { ExternalLinkButton, SettingsSection } from './bits'

export default function ProgramsSection() {
  const { state, viewer, cycleOwner } = useApp()
  const programs = programsFor(state.stage)
  if (programs.length === 0) return null
  // A soft / off / 부담 없이 viewer reads '임신 전 검사' — the roadmap's own name
  // for this check (as partnerTrack's monthly task does).
  const explicit = fertilityVoice(settingsFor(state.settings, viewer), viewer, viewer === cycleOwner.id) === 'explicit'
  const titleOf = (title: string) => (explicit ? title : title.replace('가임력 검사', '임신 전 검사'))

  return (
    <SettingsSection id="programs" title="도움이 되는 정부 지원" sub="지금 단계에서 챙겨 볼 만한 제도예요">
      <ul className="grid gap-2">
        {programs.map((p) => (
          <Card as="li" key={p.id} className="py-3">
            <p className="text-sm font-bold text-ink">{titleOf(p.title)}</p>
            <p className="mt-0.5 text-sm leading-relaxed text-ink-2">{p.benefit}</p>
            <dl className="mt-2 space-y-1 text-xs leading-relaxed">
              <div className="flex gap-2">
                <dt className="w-8 shrink-0 font-semibold text-ink-3">대상</dt>
                <dd className="min-w-0 text-ink-2">{p.who}</dd>
              </div>
              {p.deadline ? (
                <div className="flex gap-2">
                  <dt className="w-8 shrink-0 font-semibold text-ink-3">기한</dt>
                  <dd className="flex min-w-0 items-start gap-1 text-ink-2">
                    <Icon name="clock" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-3" strokeWidth={2.2} />
                    <span>{p.deadline}</span>
                  </dd>
                </div>
              ) : null}
            </dl>
            <div className="mt-2 flex items-center justify-between gap-2">
              <span className="min-w-0 text-[11px] leading-snug text-ink-3">{effectiveLabel(p.effective)}</span>
              <ExternalLinkButton href={p.url} label={`${titleOf(p.title)} — ${p.urlLabel}에서 보기 (새 창)`}>
                {p.urlLabel}
              </ExternalLinkButton>
            </div>
          </Card>
        ))}
      </ul>
      <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-3">
        금액·조건은 해마다 바뀌어요. 신청 전 공식 페이지에서 확인하세요 (확인일 {formatDot(PROGRAMS_CHECKED_AT)}). 지역마다 추가
        지원이 있을 수 있어요.
      </p>
    </SettingsSection>
  )
}
