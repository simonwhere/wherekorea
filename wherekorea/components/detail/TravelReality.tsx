import { getTravelEvidence } from '@/data/travel-evidence'
import SectionTitle from '@/components/detail/SectionTitle'

export default function TravelReality({ slug }: { slug: string }) {
  const evidence = getTravelEvidence(slug)
  if (!evidence) return null
  return <section className="py-6 border-b border-white/10" aria-labelledby="travel-reality-heading">
    <SectionTitle className="mb-3"><span id="travel-reality-heading">Local connections</span></SectionTitle>
    <p className="text-sm font-medium text-white/95 mb-3">{evidence.summary}</p>
    <ul className="text-sm text-white/80 leading-relaxed space-y-2 list-disc pl-5">
      {evidence.cautions.map((text) => <li key={text}>{text}</li>)}
    </ul>
    {evidence.bookingLinks.map((link) => <div key={link.url} className="mt-3">
      <a href={link.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-sm text-[#ffb495] underline underline-offset-4">
        {link.label} ↗<span className="sr-only"> (opens in a new tab)</span>
      </a>
    </div>)}
    <details className="mt-4 text-xs text-white/70 leading-relaxed">
      <summary className="cursor-pointer min-h-11 py-3 text-white/90">Transport sources</summary>
      <p className="mb-3">Last checked: {evidence.checkedAt}. Check current timetables and fares before travel.</p>
      <ul className="space-y-3">
        {evidence.claims.map((claim) => <li key={claim.text}>
          <p>{claim.text}</p>
          {claim.sourceIds.map((id) => {
            const source = evidence.sources.find((item) => item.id === id)
            return source ? <div key={id}>
              <a href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center mr-3 underline text-[#ffb495]">
                {source.label} · {source.language} ↗<span className="sr-only"> (opens in a new tab)</span>
              </a>
              <p className="text-white/60">{source.publisher} · {source.scope}</p>
            </div> : null
          })}
        </li>)}
      </ul>
      {evidence.bookingLinks.map((link) => <p key={link.url} className="mt-3">{link.publisher}: {link.scope}</p>)}
    </details>
  </section>
}
