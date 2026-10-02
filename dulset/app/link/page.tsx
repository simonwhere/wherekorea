'use client'

// /link — the partner's no-install page (Next A ①). A separate static route
// (out/link/…) with no StoreProvider: it never loads the app state, only the
// snapshot its token can see (components/link/LinkPage).

import LinkPage from '@/components/link/LinkPage'

export default function Page() {
  return <LinkPage />
}
