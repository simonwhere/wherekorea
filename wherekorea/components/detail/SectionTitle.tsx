interface Props {
  children: React.ReactNode
  className?: string
}

/** High-emphasis section header for detail pages: accent tick + bright text. */
export default function SectionTitle({ children, className = '' }: Props) {
  return (
    <h2
      className={`flex items-center gap-2 text-[13px] font-bold text-white/90 uppercase tracking-wider ${className}`}
    >
      <span
        aria-hidden
        className="w-1 h-3.5 rounded-full shrink-0"
        style={{ background: '#FF6A3D' }}
      />
      {children}
    </h2>
  )
}
