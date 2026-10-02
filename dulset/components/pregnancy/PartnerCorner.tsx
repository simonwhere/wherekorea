'use client'

import { Card, SectionTitle } from '@/components/ui'
import { Icon } from '@/components/ui/icons'
import { TRIMESTER_LABEL, type PartnerIdea, type Trimester } from '@/lib/content/pregnancy'
import { partnerIdeasFor } from '@/lib/logic/pregnancyView'
import { useApp } from '@/lib/store'
import { goToTab } from './nav'

const linkClass =
  'mt-0.5 inline-flex min-h-[44px] items-center text-xs font-semibold text-brand-ink underline-offset-2 hover:underline'

export default function PartnerCorner({ trimester }: { trimester: Trimester }) {
  const { me, cycleOwner } = useApp()
  const ideas = partnerIdeasFor(trimester)
  const iAmCarrying = me.id === cycleOwner.id

  return (
    <section className="mt-6">
      <SectionTitle
        sub={
          iAmCarrying
            ? `${TRIMESTER_LABEL[trimester]}에 파트너에게 이렇게 부탁해도 좋아요`
            : `${TRIMESTER_LABEL[trimester]}에 이렇게 함께할 수 있어요`
        }
      >
        파트너와 함께
      </SectionTitle>
      <Card className="py-2">
        <ul className="divide-y divide-line/70">
          {ideas.map((idea) => (
            <li key={idea.id} className="flex gap-3 py-2.5">
              <span
                aria-hidden
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-him-soft text-xl"
              >
                {idea.icon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">{idea.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-2">{idea.body}</p>
                {idea.link ? <IdeaLink link={idea.link} /> : null}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </section>
  )
}

function IdeaLink({ link }: { link: NonNullable<PartnerIdea['link']> }) {
  if (link.kind === 'url') {
    return (
      <a href={link.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
        {link.label}
        <Icon name="ext" className="ml-0.5 h-3.5 w-3.5" strokeWidth={2.2} />
        <span className="sr-only"> (새 창)</span>
      </a>
    )
  }
  return (
    <button
      type="button"
      className={linkClass}
      onClick={() => goToTab(link.tab)}
    >
      {link.label} →
    </button>
  )
}
