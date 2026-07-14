import type { FilterTag } from '@/data/types'

interface Props {
  activeFilters: FilterTag[]
  onToggle: (tag: FilterTag) => void
  onClearAll: () => void
}

const FILTER_GROUPS: { label: string; tags: FilterTag[] }[] = [
  { label: 'Place', tags: ['coastal', 'history / traditional', 'city', 'nature', 'mountain / hiking'] },
  { label: 'Style', tags: ['no-car friendly', 'couple', 'solo'] },
  { label: 'Stay',  tags: ['1–2 days', '3 days', '4+ days'] },
]

// User-intent display labels — FilterTag values and filter logic are unchanged
const DISPLAY_LABELS: Record<FilterTag, string> = {
  'coastal':               'Beach & Coast',
  'history / traditional': 'Culture & History',
  'city':                  'City',
  'nature':                'Nature',
  'mountain / hiking':     'Mountains',
  'no-car friendly':       'No Car Needed',
  'couple':                'Couples',
  'solo':                  'Solo',
  '1–2 days':              'Weekend',
  '3 days':                '3 Days',
  '4+ days':               '4+ Days',
}

export default function FilterStrip({ activeFilters, onToggle, onClearAll }: Props) {
  return (
    <div className="sticky top-0 z-20 border-b border-white/[0.07] bg-gray-900">
      {/*
        Mobile: single horizontal scroll row, no group labels, no wrap.
        Desktop (sm+): grouped rows with labels, wraps naturally.
      */}
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6">
        <div
          className="
            flex items-center gap-2 py-3
            overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]
            sm:flex-wrap sm:gap-x-1.5 sm:gap-y-2.5 sm:overflow-visible
          "
        >
          {FILTER_GROUPS.map(({ label, tags }, i) => (
            <div
              key={label}
              className={`flex items-center gap-1.5 shrink-0 ${i > 0 ? 'sm:ml-4' : ''}`}
            >
              {/* Group label — desktop only */}
              <span className="hidden sm:block text-[10px] font-semibold uppercase tracking-widest text-white/25 select-none whitespace-nowrap mr-0.5">
                {label}
              </span>

              {tags.map((tag) => {
                const active = activeFilters.includes(tag)
                return (
                  <button
                    key={tag}
                    onClick={() => onToggle(tag)}
                    className={`
                      shrink-0 flex items-center gap-1 px-4 py-2 text-xs font-medium rounded-full
                      whitespace-nowrap transition-all duration-150
                      ${active
                        ? 'bg-white text-gray-900 font-semibold shadow-[0_0_0_2px_rgba(255,255,255,0.2)]'
                        : 'border border-white/[0.2] text-white/60 hover:border-white/45 hover:bg-white/[0.09] hover:text-white/95'
                      }
                    `}
                  >
                    {active && <span className="text-[9px] font-bold">✓</span>}
                    {DISPLAY_LABELS[tag]}
                  </button>
                )
              })}
            </div>
          ))}

          {/* Clear all — only when filters are active */}
          {activeFilters.length > 0 && (
            <>
              {/* Vertical divider — desktop only */}
              <div className="hidden sm:block self-stretch w-px bg-white/[0.1] mx-2 my-0.5" />
              <button
                onClick={onClearAll}
                className="
                  shrink-0 px-4 py-2 text-xs font-medium rounded-full whitespace-nowrap
                  border border-white/[0.15] text-white/55
                  hover:border-white/35 hover:bg-white/[0.06] hover:text-white/70
                  transition-all duration-150
                "
              >
                Clear filters
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
