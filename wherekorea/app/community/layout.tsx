import { Suspense } from 'react'
import Header from '@/components/layout/Header'
import CommunityNav from '@/components/community/CommunityNav'
import styles from '@/components/community/Community.module.css'
import { CommunitySessionProvider } from '@/components/community/CommunitySession'

// Query-driven community lists and guide text must be present in the initial
// response, not only in a client-rendered Suspense fallback.
export const dynamic = 'force-dynamic'

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return <><Header /><CommunitySessionProvider><main className={styles.shell}><Suspense fallback={<div className={styles.skeleton}>Loading navigation…</div>}><CommunityNav /></Suspense>{children}</main></CommunitySessionProvider></>
}
