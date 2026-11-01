'use client'

// 아빠 마음's sheet — where to talk (2026-11-01). No store here: his app
// (components/baby/DadMindCard) and his link page (components/link/LinkDadMind)
// draw the same lines.

import { Sheet } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { DAD_MIND_LINES, telHref } from '@/lib/logic/dadMind'

/** Where to talk: each line with its number as a call link (research medical.json 'mental-health-lines-kr'). */
export function DadMindSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="이야기할 곳">
      <ul className="divide-y divide-line/70" data-dad-mind-lines>
        {DAD_MIND_LINES.map((l) => (
          <li key={l.name} className="flex min-h-[56px] items-center gap-3 py-2">
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-bold tracking-[-0.02em] text-ink">{l.name}</span>
              {l.note ? <span className="block text-[12.5px] text-ink-3">{l.note}</span> : null}
            </span>
            {l.number ? (
              <a
                href={telHref(l.number)}
                className="inline-flex h-11 min-w-[88px] shrink-0 items-center justify-center gap-1.5 rounded-full bg-surface-2 px-4 text-[15px] font-extrabold tabular-nums text-ink hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
              >
                <Icon name="phone" className="h-4 w-4 shrink-0" />
                {l.number}
              </a>
            ) : null}
          </li>
        ))}
      </ul>
    </Sheet>
  )
}
