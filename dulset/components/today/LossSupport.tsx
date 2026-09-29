'use client'

// Quiet, practical support after a pregnancy ended: spouse leave, the voucher,
// counseling — each with its source (lib/logic/ttcFlow LOSS_SUPPORT).

import { Disclaimer, cx } from '@/components/ui'
import { LOSS_SUPPORT, LOSS_SUPPORT_CHECKED_AT, LOSS_SUPPORT_NOTE } from '@/lib/logic/ttcFlow'
import { ExternalLink } from './bits'

/** `heading={false}` inside the quiet moment card, whose title already says it. */
export default function LossSupport({ className, heading = true }: { className?: string; heading?: boolean }) {
  return (
    <section aria-label="도움이 되는 안내" className={className}>
      {heading ? <h3 className="text-sm font-bold text-ink">필요할 때 꺼내 봐요</h3> : null}
      <ul className={cx('divide-y divide-line/80', heading && 'mt-1')}>
        {LOSS_SUPPORT.map((item) => (
          <li key={item.id} className="py-[11px]">
            <p className="text-[14.5px] font-bold tracking-[-0.02em] text-ink">{item.title}</p>
            <p className="mt-0.5 text-[12.5px] leading-[1.45] text-ink-3">{item.body}</p>
            <div className="-mb-2 flex flex-wrap gap-x-3">
              {item.sources.map((src) => (
                <ExternalLink key={src.url} href={src.url}>
                  {src.name}
                </ExternalLink>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <Disclaimer>
        {LOSS_SUPPORT_NOTE} (확인 {LOSS_SUPPORT_CHECKED_AT})
      </Disclaimer>
    </section>
  )
}
