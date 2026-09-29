// The cover frame: a slightly tilted instant photo with a back sheet and a
// piece of tape (decorated), or a still, untilted frame (quiet weeks). The
// photo box height comes from .cover-photo-h / .cover-photo-h-quiet in
// app/globals.css, which shrink on short screens so the day's card stays on
// the first screen.

export default function Polaroid({
  children,
  caption,
  decorated = true,
  quiet = false,
  className,
}: {
  /** The photo box content: an <img> (object-cover) or <CoverArt/>, plus overlays. */
  children: React.ReactNode
  /** The strip under the photo (names on the left, a note or button on the right). */
  caption: React.ReactNode
  /** Back sheet, tape and tilt. Off during the quiet weeks after a loss. */
  decorated?: boolean
  /** The shorter photo box used during the quiet weeks. */
  quiet?: boolean
  className?: string
}) {
  return (
    <div className={className ? `relative mx-1.5 ${className}` : 'relative mx-1.5'}>
      {decorated ? (
        <>
          <div
            aria-hidden="true"
            className="absolute bottom-[-4px] left-[6px] right-[-2px] top-[6px] rotate-[2.4deg] rounded-[5px] bg-surface-2 shadow-polaroid dark:bg-surface dark:shadow-[0_10px_26px_-10px_rgb(0_0_0/.6)]"
          />
          <div
            aria-hidden="true"
            className="polaroid-tape absolute -top-[11px] left-1/2 z-10 h-[22px] w-[74px] -translate-x-1/2 -rotate-3 bg-glow/40 dark:bg-glow/30"
          />
        </>
      ) : null}
      <div
        className={
          decorated
            ? 'relative -rotate-[0.9deg] rounded-[5px] bg-surface px-2 pt-2 shadow-polaroid dark:bg-surface-2 dark:shadow-[0_10px_26px_-10px_rgb(0_0_0/.6)]'
            : 'relative rounded-[5px] bg-surface px-2 pt-2 shadow-polaroid dark:bg-surface-2 dark:shadow-[0_10px_26px_-10px_rgb(0_0_0/.6)]'
        }
      >
        <div
          className={`relative overflow-hidden rounded-[2px] bg-surface-2 ${quiet ? 'cover-photo-h-quiet' : 'cover-photo-h'}`}
        >
          {children}
        </div>
        <div className="flex h-10 items-center justify-between gap-2 px-1">{caption}</div>
      </div>
    </div>
  )
}
