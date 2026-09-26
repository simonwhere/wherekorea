'use client'

import { Card, SectionTitle } from '@/components/ui'
import { VACCINE_ALERT_TIP, VACCINE_ANCHORS, VACCINE_NOTE } from '@/lib/content/baby'
import { programById } from '@/lib/content/programs'
import { ExternalLink, primaryLinkClass } from './bits'

const FALLBACK_URL = 'https://nip.kdca.go.kr'

export default function Vaccination() {
  const program = programById('vaccination')
  const url = program?.url ?? FALLBACK_URL

  return (
    <section>
      <SectionTitle sub="전체 일정은 공식 예방접종도우미에서 확인해요">예방접종</SectionTitle>
      <Card>
        <p className="text-xs font-semibold text-ink-2">대표적인 접종 시기 몇 가지</p>
        <dl className="mt-2 grid gap-1.5">
          {VACCINE_ANCHORS.map((v) => (
            <div key={v.name} className="flex items-baseline justify-between gap-3 rounded-lg bg-surface-2 px-3 py-2">
              <dt className="min-w-0 text-sm font-medium text-ink">{v.name}</dt>
              <dd className="shrink-0 text-xs font-semibold tabular-nums text-ink-2">{v.when}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs leading-relaxed text-ink-2">{VACCINE_NOTE}</p>

        <div className="mt-3">
          <ExternalLink href={url} className={primaryLinkClass} ariaLabel="예방접종도우미에서 우리 아이 접종 일정 보기 (새 창)">
            예방접종도우미에서 일정 보기
          </ExternalLink>
        </div>

        <div className="mt-3 rounded-xl border border-line p-3">
          <p className="text-sm font-bold text-ink">
            <span aria-hidden className="mr-1">
              📱
            </span>
            국민비서로 접종 알림 받기
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-2">{VACCINE_ALERT_TIP}</p>
        </div>
      </Card>
    </section>
  )
}
