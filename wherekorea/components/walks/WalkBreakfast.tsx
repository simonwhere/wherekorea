import type { WalkBreakfast as Breakfast, WalkGuide } from '@/data/walks/types'
import styles from './WalkBreakfast.module.css'

export default function WalkBreakfast({ breakfast, food, onMap, controls }: {
  breakfast: Breakfast; food: WalkGuide['food']; onMap: (stop: number) => void; controls: string
}) {
  const { ordering } = breakfast
  const checked = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(breakfast.checked + 'T00:00:00Z'))
  return <section className={styles.breakfast} aria-label="Breakfast on this walk">
    <p className={styles.label}>Breakfast · Stop {breakfast.stop}</p>
    <h3>{breakfast.venue} <span lang="ko">{breakfast.venueKo}</span></h3>
    <p className={styles.hours}>{ordering?.summary ?? breakfast.hours}</p>
    {food.stop === breakfast.stop && <p className={styles.dish}>{food.name} <span lang="ko">{food.nameKo}</span></p>}
    <p>{breakfast.detail}</p>
    {ordering && <>
      <p className={styles.listedHours}>{breakfast.hours}</p>
      <div className={styles.contact}>
        {ordering.pickupUrl && <a href={ordering.pickupUrl} target="_blank" rel="noreferrer">Reserve pickup on Naver ↗</a>}
        <a href={'tel:' + ordering.phone.replaceAll(' ', '')}>Call {ordering.phone}</a>
      </div>
      <details className={styles.ask}><summary>Ask in Korean</summary><p lang="ko">{ordering.questionKo}</p></details>
    </>}
    <div className={styles.actions}>
      <button type="button" onClick={() => onMap(breakfast.stop)} aria-controls={controls}>Show breakfast on map <span aria-hidden="true">↓</span></button>
      <details><summary>Address &amp; source</summary><p>{breakfast.address}</p>
        <p><a href={breakfast.source.url} target="_blank" rel="noreferrer">{breakfast.source.label} ↗</a> · {ordering ? 'Listing' : 'Hours'} checked <time dateTime={breakfast.checked}>{checked}</time></p>
      </details>
    </div>
  </section>
}
