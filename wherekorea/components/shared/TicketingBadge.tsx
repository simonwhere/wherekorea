import type { Ticketing } from '@/data/signature-events'

// Foreigner-accessibility label — the honest signal nobody else gives.
// walk-in: show up / english-booking: bookable without Korean ID / id-required: hard.

const STYLES: Record<Ticketing, { label: string; bg: string; border: string; color: string }> = {
  'walk-in': {
    label: 'Walk-in OK',
    bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.30)', color: '#86efac',
  },
  'english-booking': {
    label: 'Bookable in English',
    bg: 'rgba(250,204,21,0.10)', border: 'rgba(250,204,21,0.30)', color: '#fde68a',
  },
  'id-required': {
    label: 'Hard for foreigners',
    bg: 'rgba(248,113,113,0.10)', border: 'rgba(248,113,113,0.30)', color: '#fca5a5',
  },
}

export default function TicketingBadge({ ticketing }: { ticketing: Ticketing }) {
  const s = STYLES[ticketing]
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap',
      padding: '2px 8px', borderRadius: 6,
      background: s.bg, border: `1px solid ${s.border}`, color: s.color,
    }}>
      {s.label}
    </span>
  )
}
