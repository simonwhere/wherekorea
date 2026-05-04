import type { Destination } from '@/data/types'

// Rough static SVG placeholder — good enough for layout validation.
// Replace with a structured SVG asset before scaling beyond the core destination set.

interface DotConfig {
  slug: string
  cx: number
  cy: number
  labelAnchor: 'start' | 'end'
  labelDx: number
  labelDy: number
}

const DOT_POSITIONS: DotConfig[] = [
  { slug: 'seoul',     cx: 82,  cy: 58,  labelAnchor: 'start', labelDx: 6,  labelDy: 4  },
  { slug: 'sokcho',    cx: 152, cy: 48,  labelAnchor: 'end',   labelDx: -6, labelDy: 4  },
  { slug: 'gangneung', cx: 155, cy: 90,  labelAnchor: 'end',   labelDx: -6, labelDy: 4  },
  { slug: 'gyeongju',  cx: 143, cy: 162, labelAnchor: 'end',   labelDx: -6, labelDy: 4  },
  { slug: 'busan',     cx: 142, cy: 183, labelAnchor: 'end',   labelDx: -6, labelDy: -5 },
  { slug: 'jeonju',    cx: 79,  cy: 150, labelAnchor: 'start', labelDx: 6,  labelDy: 4  },
  { slug: 'jirisan',   cx: 100, cy: 178, labelAnchor: 'start', labelDx: 6,  labelDy: 4  },
  { slug: 'tongyeong', cx: 122, cy: 204, labelAnchor: 'end',   labelDx: -6, labelDy: -5 },
  { slug: 'namhae',    cx: 96,  cy: 208, labelAnchor: 'start', labelDx: 6,  labelDy: 4  },
  { slug: 'jeju',      cx: 83,  cy: 250, labelAnchor: 'start', labelDx: 6,  labelDy: 4  },
]

interface Props {
  destinations: Destination[]
  allDestinations: Destination[]
}

export default function KoreaMap({ destinations, allDestinations }: Props) {
  const activeSlugSet = new Set(destinations.map((d) => d.slug))

  const nameBySlug = Object.fromEntries(
    allDestinations.map((d) => [d.slug, d.name])
  )

  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-xs text-gray-400 mb-2">Destination map</p>
      <svg
        viewBox="0 0 200 280"
        className="w-full max-w-[200px]"
        aria-label="Rough map of Korea showing destination locations"
      >
        {/* Mainland Korea — rough simplified outline */}
        <path
          d="M 55,15 L 90,10 L 130,14 L 150,38 L 158,72 L 162,112
             L 155,152 L 142,183 L 126,205 L 108,210 L 88,207
             L 68,198 L 50,178 L 38,148 L 35,108 L 38,70 L 45,40 Z"
          fill="#f3f4f6"
          stroke="#d1d5db"
          strokeWidth="1"
        />
        {/* Jeju island */}
        <ellipse
          cx="83"
          cy="250"
          rx="24"
          ry="12"
          fill="#f3f4f6"
          stroke="#d1d5db"
          strokeWidth="1"
        />

        {/* Destination dots */}
        {DOT_POSITIONS.map(({ slug, cx, cy, labelAnchor, labelDx, labelDy }) => {
          const active = activeSlugSet.has(slug)
          const name = nameBySlug[slug] ?? slug
          return (
            <g key={slug}>
              <circle
                cx={cx}
                cy={cy}
                r={3.5}
                fill={active ? '#111827' : '#9ca3af'}
              />
              <text
                x={cx + labelDx}
                y={cy + labelDy}
                textAnchor={labelAnchor}
                fontSize="7"
                fill={active ? '#111827' : '#9ca3af'}
                fontFamily="inherit"
              >
                {name}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
