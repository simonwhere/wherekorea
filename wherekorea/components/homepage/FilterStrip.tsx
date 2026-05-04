import type { FilterTag } from '@/data/types'

interface Props {
  activeFilters: FilterTag[]
  onToggle: (tag: FilterTag) => void
  onClearAll: () => void
}

// Visual groups — order and values must match FILTER_TAGS exactly
const FILTER_GROUPS: FilterTag[][] = [
  ['coastal', 'history / traditional', 'city', 'nature', 'mountain / hiking'],
  ['no-car friendly', 'couple', 'solo'],
  ['1–2 days', '3 days', '4+ days'],
]

export default function FilterStrip({ activeFilters, onToggle, onClearAll }: Props) {
  return (
    <div className="border-b border-white/10 bg-gray-950">
      <div className="max-w-screen-xl mx-auto px-4 py-3 flex items-center gap-1.5 flex-wrap">
        {FILTER_GROUPS.map((group, groupIndex) => (
          <div key={groupIndex} className="flex items-center gap-1.5 flex-wrap">
            {groupIndex > 0 && (
              <span className="w-px h-4 bg-white/15 mx-1 shrink-0" />
            )}
            {group.map((tag) => {
              const active = activeFilters.includes(tag)
              return (
                <button
                  key={tag}
                  onClick={() => onToggle(tag)}
                  className={`px-3.5 py-1.5 text-xs rounded-full transition-all ${
                    active
                      ? 'bg-white text-gray-900 font-semibold shadow-sm'
                      : 'bg-white/[0.07] text-white/55 hover:bg-white/[0.13] hover:text-white/85'
                  }`}
                >
                  {tag}
                </button>
              )
            })}
          </div>
        ))}

        {activeFilters.length > 0 && (
          <>
            <span className="w-px h-4 bg-white/15 mx-1 shrink-0" />
            <button
              onClick={onClearAll}
              className="px-3 py-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              × Clear
            </button>
          </>
        )}
      </div>
    </div>
  )
}
