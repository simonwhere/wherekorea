'use client'

import { useRouter } from 'next/navigation'
import { destinations } from '@/data/destinations'
import { useSaved } from '@/lib/saved-context'
import DestinationCard from '@/components/cards/DestinationCard'
import Header from '@/components/layout/Header'

export default function SavedPage() {
  const { savedList } = useSaved()
  const router = useRouter()

  const saved = savedList
    .map((slug) => destinations.find((d) => d.slug === slug))
    .filter((d): d is (typeof destinations)[0] => d !== undefined)

  return (
    <div style={{ minHeight: '100vh', background: '#16181f' }}>
      <Header />
      <main style={{ padding: '0 20px 100px', maxWidth: 1400, margin: '0 auto' }}>
        <div style={{ padding: '26px 0 4px' }}>
          <h1 style={{
            fontSize: 28, fontWeight: 800, color: '#fff',
            letterSpacing: '-0.035em', lineHeight: 1.08,
          }}>
            Saved places
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', marginTop: 6 }}>
            Your shortlist — stored on this device, no account needed.
          </p>
        </div>

        {saved.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '80px 0',
            color: 'rgba(255,255,255,0.25)', fontSize: 14,
          }}>
            Nothing saved yet — tap ♡ on any card to keep it here.
          </div>
        ) : (
          <div style={{
            marginTop: 20,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: 14,
          }}>
            {saved.map((d) => (
              <DestinationCard
                key={d.slug}
                destination={d}
                onSelect={() => router.push(`/destination/${d.slug}`)}
                isSelected={false}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
