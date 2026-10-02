'use client'

// '배란테스트기, 이렇게 해요' — one sheet, opened with lib/logLauncher
// openLHHowTo() from the LH panel ('어떻게 해요?'), the fertility guide and the
// home's 'LH 테스트 시작 D-N' card; mounted once in AppShell.
//
// Every line comes from docs/research/lh-tests.json (findings with inUI: true,
// checked 2026-10-02 — search summaries, originals to be re-read before launch).
// Numbers that file could not confirm (read-time minutes, pharmacy prices) are
// left out on purpose. Soft wording (a cycle owner with 은근하게 / 받지 않음)
// never says 배란 or 가임기.

import { useCallback, useEffect, useState } from 'react'
import { Sheet } from '@/components/ui'
import { Icon, type IconName } from '@/components/ui/icons'
import { addDays, formatKo } from '@/lib/dates'
import { cycleLens } from '@/lib/logic/calendarView'
import { LH_LEAD_DAYS, cycleAt } from '@/lib/logic/cycle'
import { canLogCycle } from '@/lib/logic/prefs'
import { OPEN_LH_HOWTO_EVENT } from '@/lib/logLauncher'
import { useApp } from '@/lib/store'

/** When the lines below were last checked against docs/research/lh-tests.json. */
export const LH_HOWTO_CHECKED_AT = '2026-10-02'

interface HowToSource {
  name: string
  url: string
}

const SOURCES = {
  mfds: { name: '식약처 웹진 2025년 5월 — 배란테스트기 바로 알기', url: 'https://mfds.go.kr/webzine/202505/sub04.html' },
  dailypharm: { name: '데일리팜 — 식약처 배란테스트기 수거검사·사용 안내', url: 'https://m.dailypharm.com/user/news/5702' },
  clearblue: { name: 'Clearblue — 검사 시작일 표', url: 'https://clearblue.com/ovulation-tests/when-to-start' },
  clearblueLeaflet: {
    name: 'Clearblue 사용설명서 (505146-10)',
    url: 'https://ca-en.clearblue.com/sites/default/files/wysiwyg/products/leaflets/505146-10%20English.pdf',
  },
  doctornowTime: { name: '닥터나우 의사 답변 — 검사 시간대', url: 'https://doctornow.co.kr/content/qna/7a1ff5176f5e418fb7f821c61f00cbd8' },
  doctornowFluids: { name: '닥터나우 의사 답변 — 사용법과 수분', url: 'https://doctornow.co.kr/content/qna/f03d7eef6af140818f69a9526fbefddb' },
  manufacturers: {
    name: '제조사 사용설명서 요약 (dotest LHa · Hi Tester)',
    url: 'https://lifeabroad.jp/html/medical_health/ovulation_tests.html',
  },
  ro: { name: 'Ro — 검사 시간대와 하루 두 번', url: 'https://ro.co/fertility/best-time-to-take-ovulation-test/' },
  retail: { name: '데일리팜 2019년 7월 — 편의점·마트 판매 허용', url: 'https://m.dailypharm.com/user/news/72231' },
  coupang: { name: '쿠팡 — 원포 배란테스트기 20개입 (가격 예시)', url: 'https://www.coupang.com/vp/products/201855302' },
} satisfies Record<string, HowToSource>

type SourceKey = keyof typeof SOURCES

interface HowToLine {
  icon: IconName
  title: string
  text: string
  sources: SourceKey[]
}

/** docs/research/lh-tests.json → findings[id] — one line each, in the order of a test day. */
const LINES: HowToLine[] = [
  {
    // start-day
    icon: 'cal',
    title: '언제부터',
    text: '시작일은 제품 설명서의 주기 길이 표를 따라요. 28일 주기면 보통 11일째부터예요. 주기가 들쭉날쭉하면 최근 6개월 중 가장 짧은 주기 기준으로 더 일찍 시작해요. 양성이 나올 때까지 매일 해요.',
    sources: ['clearblue', 'clearblueLeaflet', 'mfds', 'manufacturers'],
  },
  {
    // time-of-day
    icon: 'clock',
    title: '몇 시에',
    text: '오전 10시~오후 8시 사이, 매일 비슷한 시각에 해요.',
    sources: ['doctornowTime', 'clearblueLeaflet'],
  },
  {
    // first-morning-urine
    icon: 'sun',
    title: '아침 첫 소변은 피해요',
    text: '아침에 오르기 시작한 호르몬이 소변에 나타나기까지 시간이 걸려요. 오후나 저녁 소변이 좋아요.',
    sources: ['mfds', 'doctornowTime'],
  },
  {
    // fluids-2h
    icon: 'drop',
    title: '검사 2시간 전부터 물은 조금만',
    text: '물이나 음료를 많이 마시면 소변이 묽어져 선이 연하게 나와요.',
    sources: ['mfds', 'doctornowFluids'],
  },
  {
    // read-time
    icon: 'clock',
    title: '정해진 시간에 읽어요',
    text: '평평한 곳에 두고 제품 설명서에 적힌 시간 안에 읽어요. 제품마다 달라요.',
    sources: ['mfds', 'dailypharm'],
  },
  {
    // twice-a-day
    icon: 'moon',
    title: '연해지기 시작하면 하루 두 번',
    text: '급상승이 짧게 지나갈 수 있어요. 선이 연하게 보이기 시작하면 아침·저녁 두 번 해 보라고 권하는 제조사도 있어요. 둘셋도 하루 두 번까지 남겨요.',
    sources: ['manufacturers', 'ro'],
  },
  {
    // where-to-buy · price
    icon: 'store',
    title: '어디서, 얼마에',
    text: '약국, 온라인, 편의점·마트에서 살 수 있어요 (2019년 7월부터 편의점·마트도). 예: 온라인 20개입 약 1만 3천 원 (2026년 10월 검색 기준) · 약국·판매처마다 달라요.',
    sources: ['retail', 'coupang'],
  },
]

const SOURCE_KEYS = Object.keys(SOURCES) as SourceKey[]

function refNumbers(keys: SourceKey[]): string {
  return keys.map((k) => SOURCE_KEYS.indexOf(k) + 1).join(',')
}

/** Mounted once (AppShell); opens on the openLHHowTo() event. */
export default function LHHowTo() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(OPEN_LH_HOWTO_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_LH_HOWTO_EVENT, onOpen)
  }, [])
  const close = useCallback(() => setOpen(false), [])
  return (
    <Sheet open={open} onClose={close} title={<HowToTitle />}>
      {open ? <HowToBody /> : null}
    </Sheet>
  )
}

function useSoftWords(): boolean {
  const { state, viewer, today } = useApp()
  return cycleLens(state, viewer, today).view !== 'explicit'
}

function HowToTitle() {
  const soft = useSoftWords()
  return <>{soft ? 'LH 테스트, 이렇게 해요' : '배란테스트기, 이렇게 해요'}</>
}

/**
 * The app's own suggested start for this cycle (the same rule as the home's
 * 'LH 테스트 시작 D-N': LH_LEAD_DAYS before the estimated window) — only on the
 * cycle owner's own phone, while the dates aren't paused.
 */
function useAppStartLine(): string | null {
  const { state, today, viewer } = useApp()
  if (state.stage !== 'preparing' || !canLogCycle(state, viewer)) return null
  const lens = cycleLens(state, viewer, today)
  if (lens.pause || lens.view === 'hidden') return null
  const w = cycleAt(state, today)
  if (!w || w.basis === 'lh') return null
  const start = addDays(w.fertileStart, -LH_LEAD_DAYS)
  const when = start <= today ? '지금이 시작할 때예요' : `${formatKo(start, { weekday: false })}부터예요`
  return `둘셋 달력 기준으로는 ${when} (예상). 설명서 표와 며칠 다를 수 있어요 — 일찍 시작하면 놓칠 일은 줄고 테스트기는 더 들어요.`
}

function HowToBody() {
  const soft = useSoftWords()
  const appLine = useAppStartLine()
  return (
    <div className="space-y-4 pb-2">
      <p className="text-[13px] leading-relaxed text-ink-2">
        {soft ? 'LH 테스트기' : '배란테스트기(LH)'}는 소변 속 LH가 급상승하는 때를 보는 검사예요. 결과는 ‘+ 기록’에 남기면 돼요.
      </p>
      <ol className="space-y-2">
        {LINES.map((line, i) => (
          <li key={line.title} className="rounded-xl border border-line bg-surface p-3">
            <p className="flex items-start gap-2 text-sm font-bold text-ink">
              <Icon name={line.icon} className="mt-px h-[18px] w-[18px] shrink-0 text-ink-2" />
              <span className="min-w-0 flex-1">{line.title}</span>
              <span className="shrink-0 text-[11px] font-normal text-ink-3" aria-label={`근거 ${refNumbers(line.sources)}`}>
                [{refNumbers(line.sources)}]
              </span>
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">{line.text}</p>
            {i === 0 && appLine ? <p className="mt-1.5 rounded-lg bg-brand-soft px-2.5 py-1.5 text-xs leading-relaxed text-brand-ink">{appLine}</p> : null}
          </li>
        ))}
      </ol>
      <p className="text-[11px] leading-relaxed text-ink-3">
        참고용이에요. 피임 목적으로 쓰지 말고, 자세한 건 제품 설명서와 약사·의사에게 물어봐요. 병원·회사·판매처마다 달라요.
      </p>
      <details className="group rounded-xl bg-surface-2 px-3">
        <summary className="flex min-h-[44px] cursor-pointer list-none items-center text-xs font-semibold text-ink-2 [&::-webkit-details-marker]:hidden">
          근거 보기 ({SOURCE_KEYS.length}) · 확인일 {LH_HOWTO_CHECKED_AT}
          <Icon name="chev" className="ml-1 h-4 w-4 transition-transform group-open:rotate-180" strokeWidth={2.2} />
        </summary>
        <ol className="space-y-1 pb-3 text-[11px] leading-relaxed text-ink-2">
          {SOURCE_KEYS.map((k, i) => (
            <li key={k} className="flex gap-1.5">
              <span className="shrink-0 tabular-nums text-ink-3">{i + 1}.</span>
              <a
                href={SOURCES[k].url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center font-medium text-brand-ink underline-offset-2 hover:underline"
              >
                {SOURCES[k].name}
                <Icon name="ext" className="ml-0.5 h-3.5 w-3.5" strokeWidth={2.2} />
              </a>
            </li>
          ))}
        </ol>
        <p className="pb-3 text-[11px] leading-relaxed text-ink-3">검색 결과 요약을 바탕으로 정리했고, 원문은 출시 전에 다시 확인해요.</p>
      </details>
    </div>
  )
}
