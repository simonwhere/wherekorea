import type { Metadata } from 'next'
import './globals.css'
import { CompareProvider } from '@/lib/compare-context'
import CompareTray from '@/components/layout/CompareTray'

export const metadata: Metadata = {
  title: 'WhereKorea',
  description: 'Compare destinations in Korea and decide where to go.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
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
      </head>
      <body>
        <CompareProvider>
          {children}
          <CompareTray />
        </CompareProvider>
      </body>
    </html>
  )
}
