'use client'

import { useEffect } from 'react'
import { connectWalkMetrics } from '@/public/walk-metrics.mjs'

export default function WalkMetricsDelivery() {
  useEffect(connectWalkMetrics, [])
  return null
}
