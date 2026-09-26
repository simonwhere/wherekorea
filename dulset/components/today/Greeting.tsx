'use client'

import { useEffect, useState } from 'react'
import { formatKo } from '@/lib/dates'
import { greetingFor } from '@/lib/logic/today'
import { useApp } from '@/lib/store'

export default function Greeting() {
  const { today, me } = useApp()
  // The clock hour only picks the greeting; date logic always uses `today`.
  const [hour, setHour] = useState(() => new Date().getHours())
  useEffect(() => {
    const t = window.setInterval(() => setHour(new Date().getHours()), 5 * 60_000)
    return () => window.clearInterval(t)
  }, [])
  return (
    <div className="px-1 pb-1">
      <p className="text-xs font-medium text-ink-3">{formatKo(today, { year: true })}</p>
      <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-ink">
        {me.name}님, {greetingFor(hour)}
      </h1>
    </div>
  )
}
