import type { FestivalDataStatus } from './status'

/** Availability wording must not claim that a city has no actual events. */
export function festivalStatusMessage(state: FestivalDataStatus['state']): string {
  switch (state) {
    case 'unconfigured': return 'Current festival listings are unavailable. See official event pages for dates.'
    case 'unavailable': return 'Festival listings could not be loaded. See official event pages for dates.'
    case 'partial': return 'Some festival listings could not be loaded. See official event pages for the full schedule.'
    case 'empty': return 'No festivals found in these listings. Check local event pages for other events.'
    case 'available': return 'Check dates and admission on the official event page.'
  }
}
