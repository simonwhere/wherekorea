// 24×24 line icons (stroke = currentColor). Decorative only: every icon is
// aria-hidden, so the button or link that holds one needs its own label.
//
// One set for the whole app (review D-5): emoji stay for what people send
// (signals, reactions, moods) and for content (an idea's own emoji, a
// milestone's party); everything that works as a UI icon uses a name here.

export type IconName =
  | 'bell'
  | 'gear'
  | 'home'
  | 'cycle'
  | 'list'
  | 'heart'
  | 'cam'
  | 'plus'
  | 'check'
  | 'chev'
  | 'right'
  | 'left'
  | 'img'
  | 'move'
  | 'lock'
  | 'x'
  | 'ext'
  | 'search'
  | 'cal'
  | 'pin'
  | 'bulb'
  | 'mail'
  | 'thumb'
  | 'book'
  | 'sprout'
  | 'baby'
  | 'bump'
  | 'users'
  | 'trash'
  | 'ruler'
  | 'phone'
  | 'shield'
  | 'ban'
  | 'box'
  | 'link'
  | 'clock'
  | 'ring'
  | 'star'
  | 'flask'
  | 'bag'
  | 'pill'
  | 'run'
  | 'hospital'
  | 'pen'
  | 'refresh'
  | 'sun'
  | 'drop'
  | 'moon'
  | 'store'
  | 'bowl'
  | 'alert'
  | 'info'
  | 'doc'
  | 'syringe'
  | 'steth'
  | 'flower'

const PATHS: Record<IconName, React.ReactNode> = {
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 1.5h-15z" />
      <path d="M10 20.5a2.2 2.2 0 0 0 4 0" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.8l1.6 2.3 2.7-.7.7 2.7 2.3 1.6-1.2 2.5 1.2 2.5-2.3 1.6-.7 2.7-2.7-.7L12 21.2l-1.6-2.3-2.7.7-.7-2.7-2.3-1.6L5.9 12 4.7 9.5 7 7.9l.7-2.7 2.7.7z" />
    </>
  ),
  // House with a small heart inside (오늘).
  home: (
    <>
      <path d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" />
      <path d="M12 17.2s-3-1.8-3-4a1.6 1.6 0 0 1 3-.8 1.6 1.6 0 0 1 3 .8c0 2.2-3 4-3 4z" />
    </>
  ),
  // An open ring with a start dot (주기).
  cycle: (
    <>
      <path d="M12 3.5a8.5 8.5 0 1 1-6 2.5" />
      <circle cx="12" cy="3.5" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="2.2" />
    </>
  ),
  list: (
    <>
      <path d="M10 6.5h10M10 12h10M10 17.5h10" />
      <path d="M3.8 6.5l1.4 1.4L7.8 5.3M3.8 12l1.4 1.4 2.6-2.6M3.8 17.5l1.4 1.4 2.6-2.6" />
    </>
  ),
  heart: <path d="M12 20s-7.5-4.4-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.6 12 20 12 20z" />,
  cam: (
    <>
      <path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.2l1.6-2h6.4l1.6 2H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5z" />
      <circle cx="12" cy="12.5" r="3.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="M5 12.5l4.2 4L19 7" />,
  chev: <path d="M6 9.5l6 6 6-6" />,
  right: <path d="M9.5 6l6 6-6 6" />,
  left: <path d="M14.5 6l-6 6 6 6" />,
  img: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <circle cx="9" cy="10" r="1.8" />
      <path d="M20.5 15.5l-4.5-4.5-8 8.5" />
    </>
  ),
  move: <path d="M12 4v16M8 7.5L12 4l4 3.5M8 16.5l4 3.5 4-3.5" />,
  lock: (
    <>
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" />
      <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6L6 18" />,
  // Arrow out of the corner: opens in a new window / another app.
  ext: <path d="M7 17L17 7M9.5 7H17v7.5" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  cal: (
    <>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 9.5h17M8 3v4M16 3v4" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  bulb: (
    <>
      <path d="M9.5 18.5h5M10.5 21h3" />
      <path d="M8.3 14.3a5.5 5.5 0 1 1 7.4 0c-.9.8-1.2 1.6-1.2 2.7h-5c0-1.1-.3-1.9-1.2-2.7z" />
    </>
  ),
  mail: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2.5" />
      <path d="M4.5 7.5l7.5 5.5 7.5-5.5" />
    </>
  ),
  thumb: (
    <>
      <path d="M4.5 11h3v9h-3z" />
      <path d="M7.5 11.5l4-7.5a2 2 0 0 1 2 2V10h4.5a1.8 1.8 0 0 1 1.8 2.1l-1.2 6.4A1.8 1.8 0 0 1 16.8 20H7.5" />
    </>
  ),
  // A notebook with its spine (일기, 기록).
  book: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <path d="M9 3.5v17M12.5 8h3" />
    </>
  ),
  sprout: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13c0-3.5-2.5-6-6-6 0 3.5 2.5 6 6 6z" />
      <path d="M12 13c0-3.5 2.5-6 6-6 0 3.5-2.5 6-6 6z" />
    </>
  ),
  // A round face with one curl.
  baby: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M9.5 14.8s.9 1.2 2.5 1.2 2.5-1.2 2.5-1.2M12 5.5c0-1.5 1-2.5 2.5-2.5" />
      <circle cx="9.6" cy="11.8" r=".7" fill="currentColor" stroke="none" />
      <circle cx="14.4" cy="11.8" r=".7" fill="currentColor" stroke="none" />
    </>
  ),
  // A side profile with a bump (임신).
  bump: (
    <>
      <circle cx="10.5" cy="5" r="2.2" />
      <path d="M8.5 9.5v11.5" />
      <path d="M8.5 9.5h3c1.8 0 3 1 3.6 2.8l.9 2.6c.7 2-.4 3.6-2.5 3.6H11" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" />
      <path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6M17.5 14.3a5.5 5.5 0 0 1 3 5.2" />
    </>
  ),
  trash: (
    <>
      <path d="M4.5 7h15M9.5 7V4.5h5V7" />
      <path d="M6.5 7l.8 12.5a1.5 1.5 0 0 0 1.5 1.5h6.4a1.5 1.5 0 0 0 1.5-1.5L17.5 7" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  ruler: (
    <>
      <rect x="2.5" y="8.5" width="19" height="7" rx="1.5" />
      <path d="M6.5 8.5v3M10 8.5v4.5M13.5 8.5v3M17 8.5v4.5" />
    </>
  ),
  phone: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7.5 3v6c0 4.5-3 7.8-7.5 9-4.5-1.2-7.5-4.5-7.5-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  ban: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M6 6l12 12" />
    </>
  ),
  box: (
    <>
      <path d="M3.5 8l8.5-4 8.5 4v9l-8.5 4-8.5-4z" />
      <path d="M3.5 8l8.5 4 8.5-4M12 12v9" />
    </>
  ),
  link: (
    <>
      <path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2" />
      <path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  ring: (
    <>
      <circle cx="12" cy="14.5" r="6" />
      <path d="M9 6.5l3-3 3 3-3 3z" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z" />,
  flask: (
    <>
      <path d="M9.5 3.5h5M10 3.5v6l-5.3 8.6A1.8 1.8 0 0 0 6.2 21h11.6a1.8 1.8 0 0 0 1.5-2.9L14 9.5v-6" />
      <path d="M7.5 15.5h9" />
    </>
  ),
  bag: (
    <>
      <path d="M8 8V6.5a4 4 0 0 1 8 0V8" />
      <rect x="4.5" y="8" width="15" height="12.5" rx="2.5" />
      <path d="M4.5 13.5h15" />
    </>
  ),
  pill: (
    <>
      <rect x="2.5" y="9" width="19" height="6" rx="3" transform="rotate(-45 12 12)" />
      <path d="M12 9v6" transform="rotate(-45 12 12)" />
    </>
  ),
  run: (
    <>
      <circle cx="14.5" cy="4.5" r="1.8" />
      <path d="M6.5 20.5l3-5.5 3-1.5 2.5 3.5 3.5 1.5" />
      <path d="M12.5 13.5l-1.5-5.5 3.5-1.5 2.5 3 3-.5M11 8L7.5 9.5l-1 3.5" />
    </>
  ),
  hospital: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M12 7.5v6M9 10.5h6M9.5 20.5v-4h5v4" />
    </>
  ),
  pen: (
    <>
      <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  refresh: (
    <>
      <path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3L19.5 9M19.5 4v5h-5" />
      <path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3L4.5 15M4.5 20v-5h5" />
    </>
  ),
  // Sunrise.
  sun: (
    <>
      <path d="M3.5 18.5h17M6 15.5a6 6 0 0 1 12 0" />
      <path d="M12 4v2.5M4.5 8.5l1.8 1.8M19.5 8.5l-1.8 1.8" />
    </>
  ),
  drop: <path d="M12 3.5s6 6.3 6 10.5a6 6 0 0 1-12 0c0-4.2 6-10.5 6-10.5z" />,
  moon: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z" />,
  store: (
    <>
      <path d="M4 9.5L5.5 4.5h13L20 9.5" />
      <path d="M4 9.5a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0" />
      <path d="M5.5 12v8.5h13V12M10 20.5v-5h4v5" />
    </>
  ),
  // A rice bowl with chopsticks (백일·돌).
  bowl: (
    <>
      <path d="M3.5 11.5h17c0 4.7-3.8 8.5-8.5 8.5s-8.5-3.8-8.5-8.5z" />
      <path d="M8 11.5L16 4M11.5 11.5L18 4.5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5l9 16h-18z" />
      <path d="M12 10v4.5M12 17.2h.01" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  doc: (
    <>
      <path d="M6.5 3.5h7l4.5 4.5v12.5h-11.5z" />
      <path d="M13.5 3.5V8H18M9.5 12.5h5M9.5 16h5" />
    </>
  ),
  // 약·주사·접종 (the medication kind, the live-vaccine wait).
  syringe: (
    <>
      <path d="M18.5 5.5l-2 2M17.5 6.5L7.8 16.2a2 2 0 0 1-1.4.6H5.2v-1.2a2 2 0 0 1 .6-1.4L15.5 4.5z" />
      <path d="M13.5 6.5l4 4M5.2 18.8L3 21M10.5 9.5l2 2M8.5 11.5l2 2" />
    </>
  ),
  // 함께 확인해 봐요 (a doctor's visit).
  steth: (
    <>
      <path d="M6.5 3.5v6a4 4 0 0 0 8 0v-6" />
      <path d="M10.5 13.5v2.5a4.5 4.5 0 0 0 9 0v-1.5" />
      <circle cx="19.5" cy="12" r="2" />
    </>
  ),
  // A first record (the 마지막 생리 card's tile).
  flower: (
    <>
      <circle cx="12" cy="10" r="2.2" />
      <path d="M12 7.8V4.5M12 12.2v8M14 8.6l2.4-2.4M10 8.6L7.6 6.2M14.2 10h3.3M6.5 10h3.3M14 11.4l2.4 2.4M10 11.4l-2.4 2.4" />
      <path d="M12 17.5c-2.2 0-4-1.3-4.5-3M12 19.5c2.2 0 4-1.3 4.5-3" />
    </>
  ),
}

export const ICON_NAMES = Object.keys(PATHS) as IconName[]

export function isIconName(value: string): value is IconName {
  return Object.prototype.hasOwnProperty.call(PATHS, value)
}

/** Size with className (h-[22px] w-[22px] …); color follows the text color. */
export function Icon({ name, className, strokeWidth = 1.8 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ? `shrink-0 ${className}` : 'h-6 w-6 shrink-0'}
    >
      {PATHS[name]}
    </svg>
  )
}

/**
 * A line icon in a soft round tile — the row/empty-state icon that replaces
 * an emoji tile. `tone` is the tile's background token class (bg-surface-2 by default).
 */
export function IconTile({
  name,
  tone = 'bg-surface-2',
  size = 'md',
  className,
}: {
  name: IconName
  tone?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const box = { sm: 'h-9 w-9', md: 'h-11 w-11 rounded-xl', lg: 'h-12 w-12' }[size]
  const glyph = { sm: 'h-[18px] w-[18px]', md: 'h-[22px] w-[22px]', lg: 'h-6 w-6' }[size]
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full text-ink-2 ${box} ${tone}${className ? ` ${className}` : ''}`}
    >
      <Icon name={name} className={glyph} />
    </span>
  )
}
