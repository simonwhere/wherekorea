import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { CompareProvider } from '@/lib/compare-context'
import CompareTray from '@/components/layout/CompareTray'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'WhereKorea',
  description: 'Compare destinations in Korea and decide where to go.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-white text-gray-900 antialiased`}>
        <CompareProvider>
          {children}
          <CompareTray />
        </CompareProvider>
      </body>
    </html>
  )
}
