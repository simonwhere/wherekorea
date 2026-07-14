import Link from 'next/link'

// S4 — set NEXT_PUBLIC_TELEGRAM_URL when the channel exists; link appears automatically.
const TELEGRAM_URL = process.env.NEXT_PUBLIC_TELEGRAM_URL

export default function Footer() {
  return (
    <footer className="border-t border-white/10 mt-16">
      <div className="max-w-screen-lg mx-auto px-5 py-8 flex flex-wrap items-center justify-between gap-4">
        <p className="text-xs text-white/50">
          <span className="text-white/85 font-semibold">WhereKorea</span> — decide where to go, with real data.
        </p>
        <nav className="flex items-center gap-5 text-xs text-white/60">
          <Link href="/about" className="hover:text-white">About & data methodology</Link>
          <Link href="/when-to-go" className="hover:text-white">When to go</Link>
          {TELEGRAM_URL && (
            <a href={TELEGRAM_URL} rel="noopener" className="hover:text-white">
              📮 This Week in Korea (Telegram)
            </a>
          )}
        </nav>
      </div>
    </footer>
  )
}
