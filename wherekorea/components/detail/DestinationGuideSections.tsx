import Link from 'next/link'
import type { DestinationGuide } from '@/data/destination-guides'
import { communityHref } from '@/lib/community'
import SectionTitle from './SectionTitle'
import styles from './DestinationGuide.module.css'

function SourceLinks({ ids, guide }: { ids: readonly string[]; guide: DestinationGuide }) {
  return <div className={styles.sourceLinks}>{ids.map(id => {
    const source = guide.sources.find(item => item.id === id)
    return source ? <a key={id} href={source.url} target="_blank" rel="noopener noreferrer">{source.label} · {source.language} ↗</a> : null
  })}</div>
}

export function DestinationOrientation({ guide }: { guide: DestinationGuide }) {
  return <section className={styles.guide} aria-labelledby="local-orientation-title">
    <SectionTitle className="mb-3"><span id="local-orientation-title">Arriving &amp; finding your bearings</span></SectionTitle>
    <div className={styles.rows}>{guide.arrival.map(item => <article className={styles.row} key={item.title}>
      <h4>{item.title}</h4><p>{item.text}</p><SourceLinks ids={item.sourceIds} guide={guide} />
    </article>)}</div>
    <h3 className={styles.subheading}>Areas to know</h3>
    <div className={styles.areas}>{guide.areas.map(item => <article className={styles.row} key={item.name}>
      <h4>{item.name}</h4><p>{item.text}</p><SourceLinks ids={item.sourceIds} guide={guide} />
    </article>)}</div>
    <h3 className={styles.subheading}>Local connections</h3>
    <div className={styles.rows}>{guide.connections.map(item => <article className={styles.row} key={`${item.from}-${item.to}`}>
      <h4>{item.from} → {item.to}</h4><p>{item.description}</p><SourceLinks ids={item.sourceIds} guide={guide} />
    </article>)}</div>
    <details className={styles.sources}>
      <summary>Sources &amp; review date</summary>
      <p>Official information reviewed {guide.reviewedAt}. Route descriptions are not live departures, available seats or a journey guarantee.</p>
      <ul>{guide.sources.map(source => <li key={source.id}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label} ↗</a><p>{source.publisher} · {source.language}. {source.scope}</p></li>)}</ul>
    </details>
  </section>
}

export function DestinationQuestions({ guide, name, contextSearch }: { guide: DestinationGuide; name: string; contextSearch: string }) {
  return <section className={styles.guide} aria-labelledby="city-questions-title">
    <SectionTitle className="mb-3"><span id="city-questions-title">Questions about {name}</span></SectionTitle>
    <p className={styles.lead}>WhereKorea answers · Official information reviewed {guide.reviewedAt}</p>
    {guide.faqs.map((faq, index) => <details className={styles.faq} key={faq.question} open={index === 0}>
      <summary>{faq.question}</summary><div className={styles.answer}><p>{faq.answer}</p><SourceLinks ids={faq.sourceIds} guide={guide} /></div>
    </details>)}
    <Link className={styles.ask} href={communityHref('/community/new', contextSearch, { city: guide.slug, type: 'questions' })}>Ask a question about {name} →</Link>
  </section>
}
