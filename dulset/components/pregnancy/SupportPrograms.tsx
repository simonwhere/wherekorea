'use client'

import { Card, SectionTitle } from '@/components/ui'
import { ONE_STOP } from '@/lib/content/pregnancy'
import { PROGRAMS_CHECKED_AT, programsFor } from '@/lib/content/programs'
import { parts } from '@/lib/dates'

const linkClass =
  'inline-flex min-h-[44px] items-center text-xs font-semibold text-brand-ink underline-offset-2 hover:underline'

export default function SupportPrograms() {
  const programs = programsFor('pregnant')
  const checked = parts(PROGRAMS_CHECKED_AT)

  return (
    <section className="mt-6">
      <SectionTitle sub={`${checked.year}년 ${checked.month}월 기준 · 금액과 기준은 바뀔 수 있어요`}>지원 제도</SectionTitle>

      <div className="grid gap-2">
        {[ONE_STOP.pregnancy, ONE_STOP.birth].map((o) => (
          <Card key={o.url} tone="muted" className="py-3">
            <p className="text-sm font-bold text-ink">{o.title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{o.body}</p>
            <a href={o.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
              정부24에서 보기 ↗<span className="sr-only"> — {o.title} (새 창)</span>
            </a>
          </Card>
        ))}
      </div>

      <ul className="mt-2 grid gap-2">
        {programs.map((p) => (
          <Card as="li" key={p.id} className="py-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 pt-0.5 text-sm font-bold text-ink">{p.title}</p>
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`${p.title} — ${p.urlLabel}에서 보기 (새 창)`}
                className="-my-2.5 -mr-2 inline-flex h-11 shrink-0 items-center px-2 text-xs font-semibold text-brand-ink underline-offset-2 hover:underline"
              >
                {p.urlLabel} ↗
              </a>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{p.benefit}</p>
            {p.deadline ? (
              <p className="mt-1.5 inline-flex rounded-lg bg-warn-soft px-2 py-1 text-[11px] font-medium text-ink-2">
                <span aria-hidden className="mr-1">
                  ⏰
                </span>
                {p.deadline}
              </p>
            ) : null}
            <details className="group">
              <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-xs font-medium text-ink-3 [&::-webkit-details-marker]:hidden">
                누가, 어떻게 신청해요?
                <span aria-hidden className="ml-1 transition-transform group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <dl className="space-y-1 pb-1 text-xs leading-relaxed text-ink-2">
                <div>
                  <dt className="inline font-semibold text-ink">대상 </dt>
                  <dd className="inline">{p.who}</dd>
                </div>
                <div>
                  <dt className="inline font-semibold text-ink">신청 </dt>
                  <dd className="inline">{p.how}</dd>
                </div>
              </dl>
            </details>
          </Card>
        ))}
      </ul>
      <p className="mt-2 px-1 text-[11px] leading-relaxed text-ink-3">
        지역마다 추가 지원이 있을 수 있어요. 주소지 보건소나 시·군·구 누리집도 확인해 보세요.
      </p>
    </section>
  )
}
