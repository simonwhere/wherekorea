import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { list } from '@vercel/blob'
import { koreaDay, receiptPrefix, summarizeReceipts, walkMetricSources } from '../lib/walk-metric-receipts.ts'

const options = process.argv.slice(2)
if (options.some(arg => !['--qa', '--connected'].includes(arg))) {
  console.error('Usage: npm run walk:report [-- --qa]')
  process.exit(1)
}
const qa = options.includes('--qa')
if (!process.env.BLOB_READ_WRITE_TOKEN && !(process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN)) {
  if (options.includes('--connected')) {
    console.error('WhereKorea production has no Blob credentials available to this CLI session.')
    process.exit(1)
  }
  // Vercel injects production credentials into this child process only.
  // Nothing is written to a dotenv file or printed by the report.
  const proc = spawnSync('npx', ['--yes', 'vercel@65.11.0', 'env', 'run', '--environment', 'production',
    '--project', 'wherekorea', '--scope', 'wheresimon', '--', process.execPath, '--disable-warning=MODULE_TYPELESS_PACKAGE_JSON',
    fileURLToPath(import.meta.url), '--connected', ...options], { stdio: 'inherit' })
  process.exit(proc.status ?? 1)
}

const paths = []
let cursor
do {
  const batch = await list({ prefix: receiptPrefix(qa), limit: 1000, cursor })
  paths.push(...batch.blobs.map(blob => blob.pathname))
  cursor = batch.hasMore ? batch.cursor : undefined
} while (cursor)

const today = koreaDay()
const rows = summarizeReceipts(paths, qa, today)
const labels = { save: '저장한 브라우저', share: '공유한 브라우저', shared_link: '공유 링크를 연 브라우저' }
const percent = (n, d) => d ? (100 * n / d).toFixed(1) + '%' : '—'
console.log((qa ? '점검용' : '운영') + ' 걷기 코스 재방문 · 한국 날짜 ' + today)
console.log('어제까지 시작한 코스의 누적 재방문')
console.table(walkMetricSources.map(source => {
  const mature = rows.filter(r => r.source === source && r.eligible)
  const starts = mature.reduce((n, r) => n + r.starts, 0)
  const returns = mature.reduce((n, r) => n + r.returned, 0)
  return { 구분: labels[source], 시작: starts, '다른 날 열기': returns, 비율: percent(returns, starts) }
}))
if (rows.length) {
  console.log('처음 행동한 날짜별')
  console.table(rows.map(r => ({ 시작일: r.day, 구분: labels[r.source], 시작: r.starts, '다른 날 열기': r.returned,
    비율: r.eligible ? percent(r.returned, r.starts) : '오늘 시작' })))
}
console.log('같은 브라우저·코스·행동은 한 번씩 셉니다. 오늘 시작한 건은 내일부터 누적 비율에 포함됩니다.')
