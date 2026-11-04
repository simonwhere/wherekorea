import type { FestivalDataStatus } from '@/lib/live/status'
import { festivalStatusMessage } from '@/lib/live/messages'

export default function LiveDataNotice({ status }: { status?: FestivalDataStatus }) {
  if (!status) return null
  return <p className="wk-live-notice" role="status">
    {festivalStatusMessage(status.state)} <span>Listings may be cached for up to 24 hours; availability is not schedule verification.</span>
  </p>
}
