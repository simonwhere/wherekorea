import type { Metadata } from 'next'

// The partner's link travels through 카카오톡: its preview (title, description,
// og:*) must carry the app's name and nothing about cycles or pregnancy —
// docs/next-a-setup.md §7. The root layout's description is the app's own
// pitch (가임기 예상 알림 …), so this route overrides it. The page is also kept
// out of search indexes: it is one couple's, behind a token.
const TITLE = '둘셋'
const DESCRIPTION = '설치 없이 바로 열려요.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: TITLE, type: 'website' },
  twitter: { card: 'summary', title: TITLE, description: DESCRIPTION },
  robots: { index: false, follow: false },
}

export default function LinkLayout({ children }: { children: React.ReactNode }) {
  return children
}
