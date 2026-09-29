import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '둘셋 — 둘이 셋이 되기까지',
  description: '임신을 준비하는 부부가 함께 쓰는 앱. 두 사람의 매일 체크, 가임기 예상 알림, 병원·검사 챙기기, 그리고 육아일기까지.',
  manifest: './manifest.webmanifest',
  // iOS ignores an SVG apple-touch-icon; the 192px PNG shows on the home screen.
  icons: { icon: './icon.svg', apple: './icon-192.png' },
  appleWebApp: { capable: true, title: '둘셋', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fbf7f1' },
    { media: '(prefers-color-scheme: dark)', color: '#16110e' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">{children}</body>
    </html>
  )
}
