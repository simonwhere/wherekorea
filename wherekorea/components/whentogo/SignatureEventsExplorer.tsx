import Link from 'next/link'
import { SIGNATURE_EVENTS } from '@/data/signature-events'
import { KOREAN_NAMES } from '@/data/destinations-meta'
import { withBrowseContext, type BrowseState } from '@/lib/browse-state'
import { signatureEventsForMonth, signatureTimingLabel, TIMING_MONTHS } from '@/components/whentogo/timing-model'

function cityLabel(slug: string): string {
  return slug === 'damyang-boseong' ? 'Damyang & Boseong' : slug.charAt(0).toUpperCase() + slug.slice(1)
}

interface Props {
  browse: BrowseState
  allowedCities: string[]
  contextSearch: string
}

export default function SignatureEventsExplorer({ browse, allowedCities, contextSearch }: Props) {
  const list = signatureEventsForMonth(SIGNATURE_EVENTS, browse.month, allowedCities)
  return (
    <section aria-labelledby="signature-ideas-heading" className="rounded-xl border border-white/15 bg-white/[.03] p-4">
      <p className="text-[10px] uppercase tracking-wider font-semibold text-[#ffb495] mb-2">Events & seasons</p>
      <h2 id="signature-ideas-heading" className="text-base font-semibold text-white mb-2">
        Usually in {TIMING_MONTHS[browse.month - 1]}
      </h2>
      <p className="text-xs text-white/70 leading-relaxed mb-4">
        Usual months; check this year&apos;s dates with the organizer.
      </p>
      {list.length === 0 ? (
        <p className="text-sm text-white/75 py-3">
          No events are listed for these places in this month. Other events may be available.
          Try another month or change your filters in Explore.
        </p>
      ) : (
        <ul className="divide-y divide-white/10">
          {list.map((event) => (
            <li key={event.city + '-' + event.name} className="py-3 first:pt-0 last:pb-0">
              <p className="text-sm text-white/90 leading-relaxed">{event.name}</p>
              <p className="text-[11px] text-white/65 mt-1">{signatureTimingLabel(event)}</p>
              <Link href={withBrowseContext('/destination/' + event.city, contextSearch)}
                className="mt-2 inline-flex min-h-8 items-center gap-2 text-xs font-semibold text-[#ffb495] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ff936b]">
                {cityLabel(event.city)} <span className="font-normal text-white/60" lang="ko">{KOREAN_NAMES[event.city]}</span>
                <span aria-hidden="true">↗</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-white/65 leading-relaxed mt-4 border-t border-white/10 pt-3">
        Dates, admission and booking requirements can change. Check the organizer&apos;s current announcement.
      </p>
    </section>
  )
}
