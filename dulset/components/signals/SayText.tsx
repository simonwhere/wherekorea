// '해 줄 말 · 아껴 둘 말' as two quiet lines — pure (no store), so the partner
// page (components/link) draws the same lines as the app without pulling
// lib/store into /link. The words come from lib/logic/signals (sayForSignal /
// sayForTold), never from her records. components/signals/SayLines
// re-exports this next to the app's one-tap answers (ToldAnswers).

import { cx } from '@/components/ui'

/** The two lines, quietly, under the moment they belong to. */
export function SayLines({ say, save, className }: { say: string; save: string; className?: string }) {
  return (
    <div data-say-lines className={cx('space-y-1 text-[13px] leading-[1.55] text-ink-2', className)}>
      <p>
        <b className="font-bold text-ink">해 줄 말</b> · {say}
      </p>
      <p>
        <b className="font-bold text-ink">아껴 둘 말</b> · {save}
      </p>
    </div>
  )
}
