// 24×24 line icons (stroke = currentColor). Decorative only: every icon is
// aria-hidden, so the button or link that holds one needs its own label.

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
  | 'img'
  | 'move'
  | 'lock'

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
