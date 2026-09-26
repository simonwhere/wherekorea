import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '둘셋 — 둘이 셋이 되기까지',
  description: '임신을 준비하는 부부가 함께 쓰는 앱. 영양제 체크, 가임기 알림, 데이트 제안, 그리고 육아일기까지.',
  manifest: './manifest.webmanifest',
  icons: { icon: './icon.svg', apple: './icon.svg' },
  appleWebApp: { capable: true, title: '둘셋', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf7f4' },
    { media: '(prefers-color-scheme: dark)', color: '#161312' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
