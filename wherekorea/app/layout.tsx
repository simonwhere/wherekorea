import type { Metadata } from 'next'
import './globals.css'
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION, SITE_URL } from '@/lib/site'
import { CompareProvider } from '@/lib/compare-context'
import { SavedProvider } from '@/lib/saved-context'
import CompareTray from '@/components/layout/CompareTray'
import WalkMetricsDelivery from '@/components/walks/WalkMetricsDelivery'
import Footer from '@/components/layout/Footer'
import { getAnalyticsConfig, analyticsBootstrap } from '@/lib/analytics-config'

// S1 — site-wide SEO defaults. Per-page titles use the template; canonical is set per page.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: `${SITE_NAME} — ${SITE_TAGLINE}`, template: `%s — ${SITE_NAME}` },
  description: SITE_DESCRIPTION,
  openGraph: { siteName: SITE_NAME, type: 'website', locale: 'en_US' },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
}

// Prefer the actual site-specific URL from the account's installation settings.
const analytics = getAnalyticsConfig(process.env.NEXT_PUBLIC_PLAUSIBLE_SCRIPT_URL, process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN)

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* App Router owns the document head; these styles are intentionally global. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        {analytics.mode !== 'disabled' && <>
          <script id="wk-analytics-queue" dangerouslySetInnerHTML={{ __html: analyticsBootstrap(analytics.mode) }} />
          <script defer data-domain={analytics.mode === 'legacy' ? analytics.domain : undefined} src={analytics.src} />
        </>}
      </head>
      <body>
        <WalkMetricsDelivery />
        <CompareProvider>
          <SavedProvider>
            {children}
            <Footer />
            <CompareTray />
          </SavedProvider>
        </CompareProvider>
      </body>
    </html>
  )
}
