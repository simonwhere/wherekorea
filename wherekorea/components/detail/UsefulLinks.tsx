import type { Destination } from '@/data/types'
import { getOfficialLinks, type OfficialTravelLink } from '@/data/official-links'
import SectionTitle from '@/components/detail/SectionTitle'

export default function UsefulLinks({ destination }: { destination: Destination }) {
  const officialLinks = getOfficialLinks(destination.slug)
  const destinationLinks: Array<{ label: string; url: string } & Partial<OfficialTravelLink>> = [
    ...officialLinks,
    ...destination.useful_links.filter((link) => /^https?:\/\//.test(link.url)),
  ].filter((link, index, links) => links.findIndex((item) => item.url === link.url) === index)
  const hasDestinationLinks = destinationLinks.length > 0
  const links: typeof destinationLinks = hasDestinationLinks ? destinationLinks : [{
    label: 'VISITKOREA · general Korea travel information',
    url: 'https://english.visitkorea.or.kr/svc/main/index.do',
  }]
  return (
    <section className="py-6 border-b border-white/10">
      <SectionTitle className="mb-2">Check before you go</SectionTitle>
      <p className="text-xs text-white/60 mb-3">{hasDestinationLinks
        ? 'Official guides for transport, opening hours and local information.'
        : 'General travel information from Korea’s official tourism site.'}</p>
      <ul className="space-y-2">
        {links.map((link) => (
          <li key={link.url}>
            <a className="inline-flex min-h-11 items-center py-2 text-sm underline underline-offset-4 text-white/90" href={link.url} target="_blank" rel="noopener noreferrer">
              {link.label} ↗<span className="sr-only"> (opens in a new tab)</span>
            </a>
            {link.provider && <p className="text-xs text-white/65">{link.provider} · {link.language}</p>}
            {link.scope && <details className="mt-1 text-xs leading-relaxed text-white/60"><summary className="cursor-pointer">About this link</summary><p className="mt-1">{link.scope}</p></details>}
          </li>
        ))}
      </ul>
    </section>
  )
}
