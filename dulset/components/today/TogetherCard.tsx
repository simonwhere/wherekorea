'use client'

// '같이 챙길 것' on the 함께하는 사람's home (founder request 2026-10-09:
// "여자가 챙겨야 할 것들을 남자에게도 계속 보여줘야해 같이 하는거야").
//
// Her near-term roadmap items (tests, checkups, vaccines, vouchers, admin,
// work programs) — and, while pregnant, the ones they share — each with what
// HE can do to share it (the item's support line) and [같이 할게요]
// (components/plan/SupportButton → lib/logic/together supportItem). One view
// model for the app and the link: lib/logic/together togetherItems.
//  • Her items show a neutral status only ('예정 · 10월 21일', '이번 주',
//    '했어요 ✓'): a passed deadline or a lapsed window of hers simply leaves
//    the list — never '기한 지남', a red warning or '안 했어요' about her.
//  • Preparing: '지은님 챙길 것 · 같이' (hers only, up to three), right after
//    his '이번 주 우리 둘'. Pregnant: '이번 주 같이 챙길 것' (hers + the shared ones).
//  • Nothing for the person whose cycle it is, and nothing in the 42 quiet days
//    after a loss (togetherItems is empty then).
// The rows are compact (one line + the support line): the card sits below the
// moment, so the home's fold rule (moment title + action above the tab bar)
// is untouched; on a short phone the rows tighten a little more.

import type { TabKey } from '@/components/AppShell'
import SupportButton from '@/components/plan/SupportButton'
import { cx } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { ROADMAP_KIND_ICON } from '@/components/ui/kindIcons'
import { NEUTRAL_UPCOMING_LABEL, carrierOf, togetherItems, type TogetherItem, type TogetherWhose } from '@/lib/logic/together'
import { useApp } from '@/lib/store'
import { LinkButton } from './bits'

/** At most this many rows on the home (the rest live in 챙길 것). */
export const TOGETHER_HOME_MAX = 3

const LABEL_TONE: Record<string, string> = {
  done: 'bg-ok-soft text-ink-2',
  'this-week': 'bg-brand-soft text-brand-ink',
  now: 'bg-brand-soft text-brand-ink',
  soon: 'bg-brand-soft text-brand-ink',
  overdue: 'bg-warn-soft text-ink-2',
}

export default function TogetherCard({
  stage,
  exclude,
  onNavigate,
  className,
}: {
  /** 'preparing' → hers only ('지은님 챙길 것 · 같이'); 'pregnant' → hers + shared ('이번 주 같이 챙길 것'). */
  stage: 'preparing' | 'pregnant'
  /** Items another card on the same home already carries (his 이번 달 할 일) — left out before the cut to three. */
  exclude?: readonly string[]
  onNavigate: (tab: TabKey) => void
  className?: string
}) {
  const { state, today, me, cycleOwner } = useApp()
  if (carrierOf(state) === me.id) return null
  const whose: TogetherWhose[] = stage === 'pregnant' ? ['theirs', 'ours'] : ['theirs']
  const rows = togetherItems(state, today, me.id, { whose, limit: TOGETHER_HOME_MAX, ...(exclude?.length ? { exclude } : {}) })
  if (!rows.length) return null
  const title = stage === 'pregnant' ? '이번 주 같이 챙길 것' : `${cycleOwner.name}님 챙길 것 · 같이`

  return (
    <section
      aria-labelledby="together-card-title"
      data-together-card={stage}
      className={cx(
        'rounded-card bg-surface px-[18px] pb-2 pt-3.5 shadow-warm dark:border dark:border-line/70 dark:shadow-none',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 pt-0.5">
          <h2 id="together-card-title" className="flex items-center gap-1.5 text-[12.5px] font-bold tracking-[-0.01em] text-brand-ink">
            <Icon name="users" className="h-4 w-4 shrink-0 text-him" />
            {title}
          </h2>
          <p className="mt-0.5 text-[12.5px] leading-[1.45] text-ink-3">
            할 수 있는 걸 골라 [같이 할게요]를 누르면 {cycleOwner.name}님 화면에도 보여요.
          </p>
        </div>
        <LinkButton onClick={() => onNavigate('plan')} arrow className="-mr-1 -mt-2.5 shrink-0">
          전체 보기
          <span className="sr-only">: 챙길 것 탭</span>
        </LinkButton>
      </div>
      <ul className="mt-1 divide-y divide-line/70">
        {rows.map((row) => (
          <Row key={row.id} row={row} />
        ))}
      </ul>
    </section>
  )
}

function Row({ row }: { row: TogetherItem }) {
  const done = row.status === 'done'
  // A shared item with no day yet reads '예정' like hers do (togetherRow gives it no label).
  const label = row.label ?? (done ? null : NEUTRAL_UPCOMING_LABEL)
  return (
    <li className="flex items-start gap-3 py-2.5 [@media(max-height:700px)]:py-2" data-together-row={row.id}>
      <span aria-hidden className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2">
        <Icon name={ROADMAP_KIND_ICON[row.kind]} className="h-[17px] w-[17px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
          <span title={row.title} className={cx('min-w-0 text-[14.5px] font-bold tracking-[-0.02em]', done ? 'text-ink-3' : 'text-ink')}>
            {row.short}
          </span>
          {label ? (
            <span
              data-together-label
              className={cx(
                'inline-flex shrink-0 items-center rounded-full px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums',
                LABEL_TONE[row.status] ?? 'bg-surface-2 text-ink-3',
              )}
            >
              {label}
            </span>
          ) : null}
          {row.whose === 'ours' ? <span className="text-[11px] font-semibold text-ink-3">둘이 함께</span> : null}
        </p>
        {row.support && !done ? (
          <p className="mt-0.5 text-[12.5px] leading-[1.45] text-ink-2" data-support-line>
            {row.support}
          </p>
        ) : null}
      </div>
      <SupportButton
        itemId={row.id}
        title={row.short}
        supported={row.supported}
        canSupport={row.canSupport}
        done={done}
        className="mt-0.5"
      />
    </li>
  )
}
