'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'
import { track } from '@/lib/analytics'

export default function CommunityEntryLink({ href, city, children, className }: {
  href: string; city: string; children: ReactNode; className?: string
}) {
  return <Link href={href} className={className} onClick={() => track('community_opened', { source: 'destination', city })}>{children}</Link>
}
