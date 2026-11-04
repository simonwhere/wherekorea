import type { DestinationImage } from '@/data/types'

/** Attribution stays available wherever a credited photograph is used. */
export default function PhotoCredit({ image, className = '', compact = false }: { image: DestinationImage; className?: string; compact?: boolean }) {
  if (!image.credit) return null
  const credit = <>
      {image.sourceUrl
        ? <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer" aria-label={`Photo source: ${image.credit} (opens in a new tab)`}>{image.credit}</a>
        : <span>{image.credit}</span>}
      {image.licenseUrl && <> · <a href={image.licenseUrl} target="_blank" rel="noopener noreferrer" aria-label="Photo licence (opens in a new tab)">Licence</a></>}
      <span> · Cropped and shaded</span>
      {image.licenseUrl === 'https://creativecommons.org/licenses/by-sa/4.0/' && <span> · Adapted image under CC BY-SA 4.0</span>}
    </>
  return compact ? <details className={`wk-photo-credit wk-credit-disclosure ${className}`}>
    <summary>Photo credit</summary>
    <p>{credit}</p>
  </details> : <p className={`wk-photo-credit ${className}`}>{credit}</p>
}
