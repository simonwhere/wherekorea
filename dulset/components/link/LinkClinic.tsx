'use client'

// 병원과 함께일 때 남편의 주 (Now 3 N32) — inside the moment card on his link
// while the couple's clinic mode is on: the appointments of the next seven
// days that are his or '둘이 함께', as the snapshot carries them (the day,
// the time, the place and a kind word — never the title, the note, a
// treatment or a count: lib/logic/partnerSnapshot linkClinic), each '둘이
// 함께' row with a [같이 갈게요] one-tap ('join-appointment' event — an id
// only; her phone keeps it and tells her), and one line about 난임치료휴가
// with its source. Only appointments the two of them put in: nothing here
// finds or suggests a hospital (docs/positioning.md §6).

import { ExternalLink } from '@/components/today/bits'
import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import type { SnapshotAppointment, SnapshotClinic } from '@/lib/logic/partnerSnapshot'
import type { ISODate } from '@/lib/types'
import { Pill } from './bits'
import { clinicWhen } from './model'

export default function LinkClinic({
  clinic,
  today,
  onJoin,
  className,
}: {
  /** His clinic week with his local marks applied (model.viewClinic). */
  clinic: SnapshotClinic
  today: ISODate
  onJoin: (a: SnapshotAppointment) => void
  className?: string
}) {
  const list = clinic.appointments
  return (
    <div className={className} data-clinic>
      {list.length ? (
        <>
          <p className="text-[13px] font-bold text-ink">이번 주 병원 일정</p>
          <ul aria-label="이번 주 병원 일정" className="mt-0.5 divide-y divide-line/70">
            {list.map((a) => (
              <li key={a.id} className="flex items-start gap-3 py-2.5" data-clinic-appt={a.id}>
                <span aria-hidden className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand-ink">
                  <Icon name="cal" className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14.5px] font-bold tracking-[-0.02em] text-ink">{clinicWhen(a.date, a.time, today)}</p>
                  <p className="text-[12.5px] leading-[1.5] text-ink-3">
                    {a.label}
                    {a.place ? ` · ${a.place}` : ''} · {a.with === 'both' ? '둘이 함께' : '내 일정'}
                  </p>
                  {a.with === 'both' ? (
                    <div className="mt-2">
                      {a.joined ? (
                        <span role="status" className="inline-flex min-h-10 items-center gap-1 text-[13.5px] font-bold text-ok">
                          <Icon name="check" className="h-4 w-4" strokeWidth={2.6} />
                          같이 가요
                        </span>
                      ) : (
                        <Pill tone="primary" onClick={() => onJoin(a)} ariaLabel={`${clinicWhen(a.date, a.time, today)} 일정에 같이 갈게요`}>
                          같이 갈게요
                        </Pill>
                      )}
                    </div>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div className={cx('text-[12.5px] leading-[1.55] text-ink-2', list.length ? 'mt-1 border-t border-line/70 pt-2.5' : '')}>
        <p>
          <b className="font-bold text-ink">알아 두면 좋아요</b> · {clinic.leave.text}. {clinic.leave.note}.
        </p>
        <ExternalLink href={clinic.leave.source.url} className="-mb-2 text-[12px]">
          출처 {clinic.leave.source.label}
        </ExternalLink>
      </div>
    </div>
  )
}
