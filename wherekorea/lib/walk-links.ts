/** Public stop numbers are one-based and follow the published walking order. */
export function walkStopNumber(value: unknown, count: number): number | undefined {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return
  const stop = Number(value)
  return Number.isSafeInteger(stop) && stop <= count ? stop : undefined
}

export function walkStopPath(slug: string, stop: number): string {
  return `/walks/${slug}?stop=${stop}`
}
