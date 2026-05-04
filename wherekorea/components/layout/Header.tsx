interface Props {
  searchQuery: string
  onSearchChange: (value: string) => void
}

export default function Header({ searchQuery, onSearchChange }: Props) {
  return (
    <header className="sticky top-0 z-20 bg-gray-950 border-b border-white/10">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-4">
        <span className="text-base font-semibold tracking-tight text-white shrink-0">
          WhereKorea
        </span>
        <div className="flex-1 max-w-sm">
          <input
            type="search"
            placeholder="Search destinations"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full h-8 px-3 text-sm bg-white/10 border border-white/20 rounded-full text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-white/40"
          />
        </div>
      </div>
    </header>
  )
}
