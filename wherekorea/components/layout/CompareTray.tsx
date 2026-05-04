'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCompare } from '@/lib/compare-context'
import { destinations } from '@/data/destinations'

export default function CompareTray() {
  const { compareList, toggleCompare } = useCompare()
  const pathname = usePathname()
  const router = useRouter()

  if (compareList.length === 0) return null

  const selected = compareList
    .map((slug) => destinations.find((d) => d.slug === slug))
    .filter((d): d is (typeof destinations)[0] => d !== undefined)

  const compareHref = `/compare?destinations=${selected.map((d) => d.slug).join(',')}`
  const canCompare = selected.length >= 2

  function handleRemove(slug: string) {
    toggleCompare(slug)

    if (pathname === '/compare') {
      const remaining = selected.filter((d) => d.slug !== slug)
      if (remaining.length >= 2) {
        router.replace(`/compare?destinations=${remaining.map((d) => d.slug).join(',')}`)
      } else {
        router.replace('/')
      }
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-white border-t border-gray-200 shadow-lg">
      <div className="max-w-screen-xl mx-auto px-4 h-14 flex items-center gap-3">
        <span className="text-xs font-medium text-gray-500 shrink-0">
          Compare
        </span>
        <div className="flex gap-2 flex-1">
          {selected.map((d) => (
            <div
              key={d.slug}
              className="flex items-center gap-1.5 bg-gray-100 rounded px-2.5 py-1 text-sm"
            >
              <span className="font-medium text-gray-800">{d.name}</span>
              <button
                onClick={() => handleRemove(d.slug)}
                aria-label={`Remove ${d.name} from compare`}
                className="text-gray-400 hover:text-gray-700 leading-none"
              >
                ×
              </button>
            </div>
          ))}
          {selected.length < 3 && (
            <span className="text-xs text-gray-400 self-center">
              Add up to {3 - selected.length} more
            </span>
          )}
        </div>
        {canCompare ? (
          <Link
            href={compareHref}
            className="shrink-0 px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded"
          >
            Compare
          </Link>
        ) : (
          <span className="shrink-0 px-4 py-1.5 text-sm font-medium bg-gray-900 text-white rounded opacity-30 cursor-not-allowed">
            Compare
          </span>
        )}
      </div>
    </div>
  )
}
