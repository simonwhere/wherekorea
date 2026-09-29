'use client'

import { useId } from 'react'

// The default cover: a small landscape drawn with the --il-* illustration
// tokens (app/globals.css). The time of day only picks the palette via
// data-tod; dark mode always uses the night set with a moon. It never depends
// on the cycle phase, and it is decoration only (aria-hidden).

export type TimeOfDay = 'morning' | 'day' | 'evening' | 'night'

/** Clock hour → palette: 5–11 morning, 12–17 day, 18–21 evening, otherwise night. */
export function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour <= 11) return 'morning'
  if (hour >= 12 && hour <= 17) return 'day'
  if (hour >= 18 && hour <= 21) return 'evening'
  return 'night'
}

const il = (name: string) => `rgb(var(--il-${name}))`

export default function CoverArt({
  tod,
  quiet = false,
  className,
}: {
  tod: TimeOfDay
  /** The quiet weeks after a loss: no trees, birds, stars or glow; a softer sun. */
  quiet?: boolean
  className?: string
}) {
  // SVG ids must be unique per page and safe inside url(#…).
  const uid = `ca${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  const sky = `${uid}-sky`
  const glow = `${uid}-glow`
  const night = tod === 'night'

  return (
    <svg
      viewBox="0 0 340 208"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
      data-tod={tod}
      data-quiet={quiet || undefined}
      className={className ? `block h-full w-full ${className}` : 'block h-full w-full'}
    >
      <defs>
        <linearGradient id={sky} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={il('sky-1')} />
          <stop offset=".55" stopColor={il('sky-2')} />
          <stop offset="1" stopColor={il('sky-3')} />
        </linearGradient>
        {quiet ? null : (
          <radialGradient id={glow} cx=".66" cy=".54" r=".45">
            <stop offset="0" stopColor={il('sun')} stopOpacity=".55" />
            <stop offset="1" stopColor={il('sun')} stopOpacity="0" />
          </radialGradient>
        )}
      </defs>
      <rect width="340" height="208" fill={`url(#${sky})`} />
      {/* The warm glow around the sun; at night it is a faint moonlit haze (.55 × .33 ≈ .18). */}
      {quiet ? null : (
        <rect
          width="340"
          height="208"
          fill={`url(#${glow})`}
          className={night ? 'opacity-[.33]' : 'dark:opacity-[.33]'}
        />
      )}

      {quiet ? (
        // Quiet: a lower, smaller, softer sun only (its colour dims in dark).
        <circle cx="226" cy="118" r="20" fill={il('sun')} opacity=".7" />
      ) : (
        <>
          {/* Moon (a crescent cut by the sky colour) and five stars: night and dark mode. */}
          <g className={night ? undefined : 'hidden dark:inline'}>
            <g fill={il('sun')} opacity=".55">
              <circle cx="40" cy="30" r="1.1" />
              <circle cx="96" cy="52" r=".9" />
              <circle cx="160" cy="24" r="1" />
              <circle cx="300" cy="36" r=".9" />
              <circle cx="198" cy="70" r=".8" />
            </g>
            <circle cx="248" cy="62" r="15" fill={il('sun')} />
            <circle cx="254" cy="57" r="13" fill={il('sky-1')} />
          </g>
          {/* Sun: morning, day and evening in light mode. */}
          <circle cx="226" cy="112" r="24" fill={il('sun')} className={night ? 'hidden' : 'dark:hidden'} />
          {/* Two birds, never at night. */}
          <g
            fill="none"
            stroke={il('bird')}
            strokeWidth="1.5"
            strokeLinecap="round"
            className={night ? 'hidden' : 'dark:hidden'}
          >
            <path d="M92 52q4-4 8 0q4-4 8 0" />
            <path d="M116 40q3-3 6 0q3-3 6 0" />
          </g>
        </>
      )}

      {/* Far hill, then a partial mid hill on the right. */}
      <path d="M0 150q60-34 130-22t120-8 90 10V208H0z" fill={il('hill-far')} />
      <path d="M170 160q60-26 110-18t60 4V208H170z" fill={il('hill-near')} opacity=".55" />

      {/* Two small trees leaning together. */}
      {quiet ? null : (
        <g>
          <rect x="126" y="128" width="3" height="18" rx="1.5" fill={il('trunk')} transform="rotate(8 127 146)" />
          <circle cx="131" cy="122" r="11" fill={il('tree')} />
          <rect x="143" y="126" width="3" height="20" rx="1.5" fill={il('trunk')} transform="rotate(-8 144 146)" />
          <circle cx="140" cy="118" r="13" fill={il('tree')} opacity=".92" />
        </g>
      )}

      {/* Near hill. */}
      <path d="M0 170q70-26 150-12t190-6V208H0z" fill={il('hill-near')} />
    </svg>
  )
}
