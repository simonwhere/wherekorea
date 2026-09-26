// "정확도 높이기" content for the 달력 tab. Every number here comes from the
// medical research notes (scratchpad research/medical.json, checked 2026-09-26
// via search summaries of the linked sources). Wording is wellness/reference
// only: no contraception, no diagnosis, no "success-rate" promises.

export interface Source {
  name: string
  url: string
  /** Caveat worth showing next to the source (e.g. a conflict of interest). */
  note?: string
}

export interface GuideSection {
  id: 'calendar-limits' | 'lh' | 'frequency' | 'signs' | 'doctor'
  icon: string
  title: string
  /** Title used when the viewer prefers "우리의 주간" wording. */
  softTitle?: string
  /** One-line teaser shown while the section is collapsed. */
  summary: string
  points: string[]
  /**
   * Replacement points for the hidden view (low-pressure / alerts off), which
   * must not mention 가임기 or date-timing. Omit to reuse `points`.
   */
  hiddenPoints?: string[]
  sources: Source[]
  /** Shown even when fertile-day estimates are hidden (low-pressure / off). */
  showWhenHidden: boolean
}

export const SOURCES = {
  wilcox1995: { name: 'Wilcox 외, NEJM 1995 (가임기 6일)', url: 'https://www.nejm.org/doi/full/10.1056/NEJM199512073332301' },
  wilcox2000: { name: 'Wilcox 외, BMJ 2000 (달력 예측의 한계)', url: 'https://pubmed.ncbi.nlm.nih.gov/11082086/' },
  bull2019: { name: 'Bull 외, npj Digital Medicine 2019 (61만 주기 분석)', url: 'https://www.nature.com/articles/s41746-019-0152-7' },
  johnson2018: {
    name: 'Johnson 외, Curr Med Res Opin 2018 (앱의 배란일 적중률)',
    url: 'https://www.tandfonline.com/doi/full/10.1080/03007995.2018.1475348',
    note: '저자들이 배란테스트 제조사 소속이에요.',
  },
  setton2016: {
    name: 'Setton 외, Obstet Gynecol 2016 (앱·웹사이트 53곳 비교)',
    url: 'https://journals.lww.com/greenjournal/abstract/10.1097/aog.0000000000001341~the-accuracy-of-web-sites-and-cellular-phone-applications-in',
  },
  cochrane2023: {
    name: 'Cochrane 체계적 문헌고찰 2023 (배란테스트와 시기 맞추기)',
    url: 'https://www.cochranelibrary.com/cdsr/doi/10.1002/14651858.CD011345.pub3/full',
  },
  lhSurge: { name: 'RMA Network — LH 급상승과 배란 시점', url: 'https://rmanetwork.com/blog/lh-surge-when-detect-peak-fertility-opk/' },
  asrm2022: {
    name: 'ASRM 위원회 의견 — Optimizing natural fertility (2022)',
    url: 'https://www.asrm.org/practice-guidance/practice-committee-documents/optimizing-natural-fertility-a-committee-opinion-2021/',
  },
  nice2026: {
    name: 'NICE NG257 (2026) — 임신이 늦어질 때 처음 드리는 안내',
    url: 'https://www.nice.org.uk/guidance/ng257/chapter/Initial-advice-to-people-concerned-about-delays-in-conception',
  },
  bbt: { name: 'Cleveland Clinic — 기초체온', url: 'https://my.clevelandclinic.org/health/articles/21065-basal-body-temperature' },
  mucus: { name: 'Cleveland Clinic — 자궁경부 점액', url: 'https://my.clevelandclinic.org/health/body/21957-cervical-mucus' },
  asrm2023: {
    name: 'ASRM 위원회 의견 — Definition of infertility (2023)',
    url: 'https://www.asrm.org/practice-guidance/practice-committee-documents/definition-of-infertility/',
  },
  mchAct: {
    name: '모자보건법 제2조 (난임의 정의)',
    url: 'https://www.law.go.kr/%EB%B2%95%EB%A0%B9/%EB%AA%A8%EC%9E%90%EB%B3%B4%EA%B1%B4%EB%B2%95',
  },
  eHealth: {
    name: 'e보건소 — 임신 사전건강관리 지원',
    url: 'https://www.e-health.go.kr/gh/caSrvcGud/selectMdclSupGudInfo.do?heBiz=PG00003&menuId=200097',
  },
} as const satisfies Record<string, Source>

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: 'calendar-limits',
    icon: '📐',
    title: '달력 예측은 어림값이에요',
    summary: '주기 길이만으로는 정확한 날을 알 수 없어요.',
    points: [
      '가임기가 흔히 말하는 ‘주기 10~17일’ 안에 온전히 들어오는 사람은 약 30%뿐이었어요.',
      '앱 데이터 약 61만 주기를 분석하니 배란 전 기간이 대략 10~30일로 사람·주기마다 크게 달랐어요.',
      '주기 길이로 계산하는 앱이 실제 배란일을 맞힌 비율은 21% 이하였어요.',
      '앱·웹사이트 53곳 중 가임기를 정확히 맞힌 곳은 4곳이었어요.',
      '그래서 둘셋은 예상 가임기 앞뒤로 ‘가능 범위’를 함께 보여줘요.',
    ],
    sources: [SOURCES.wilcox2000, SOURCES.bull2019, SOURCES.johnson2018, SOURCES.setton2016],
    showWhenHidden: false,
  },
  {
    id: 'lh',
    icon: '🧪',
    title: 'LH 배란테스트로 확인하기',
    softTitle: 'LH 테스트로 더 정확하게',
    summary: '달력 예측을 가장 쉽게 보완하는 방법이에요.',
    points: [
      '예상 가임기가 시작되기 며칠 전부터 테스트해 보세요.',
      '처음 양성이 나온 날과 그다음 날이 가장 좋은 때예요.',
      '배란은 보통 LH가 급상승하고 24~36시간 뒤에 일어나요.',
      '연구를 모아 보면, LH 테스트로 시기를 맞춘 경우 출생률이 더 높게 나왔어요 (상대위험 1.36, 근거 수준 중간).',
      '달력에서 날짜를 눌러 결과를 기록하면 둘셋이 예측을 바로 다시 계산해요.',
    ],
    sources: [SOURCES.cochrane2023, SOURCES.lhSurge],
    showWhenHidden: false,
  },
  {
    id: 'frequency',
    icon: '💞',
    title: '얼마나 자주면 될까요?',
    summary: '딱 맞춘 하루보다 편한 리듬이 더 중요해요.',
    points: [
      '예상 가임기엔 하루나 이틀에 한 번이 가장 좋고, 일주일에 2~3번도 거의 비슷해요 (ASRM).',
      '영국 NICE(2026)는 날짜를 맞추기보다 주기 전체에 걸쳐 2~3일에 한 번을 권해요.',
      '규칙적으로 함께하는 커플의 80% 이상이 1년 안에 임신해요 (NICE).',
      '날짜 알림이 부담되면 설정에서 ‘부담 없이 모드’를 켜 보세요.',
    ],
    hiddenPoints: [
      '영국 NICE(2026)는 날짜를 맞추기보다 주기 전체에 걸쳐 2~3일에 한 번을 권해요.',
      '미국 ASRM도 일주일에 2~3번이면 날짜를 맞춘 경우와 거의 비슷하다고 봐요.',
      '규칙적으로 함께하는 커플의 80% 이상이 1년 안에 임신해요 (NICE).',
    ],
    sources: [SOURCES.asrm2022, SOURCES.nice2026],
    showWhenHidden: true,
  },
  {
    id: 'signs',
    icon: '🌡️',
    title: '몸의 신호 (선택)',
    summary: '기초체온과 점액은 보조 신호로만 써요.',
    points: [
      '기초체온은 배란 뒤에 0.3~0.6°C 올라가요. 지난 배란을 확인하는 용도라 미리 알려주진 못해요.',
      '맑고 미끈하게 늘어나는 점액은 배란이 가까워졌다는 신호예요.',
      '여러 주기를 기록하면 내 패턴을 알아가는 데 도움이 돼요. 꼭 하지 않아도 괜찮아요.',
    ],
    sources: [SOURCES.bbt, SOURCES.mucus],
    showWhenHidden: false,
  },
  {
    id: 'doctor',
    icon: '🩺',
    title: '언제 병원에 가 볼까요?',
    summary: '기다리는 기간은 나이에 따라 달라요.',
    points: [
      '주기를 기록하는 사람이 35세 미만이면 1년, 35세 이상이면 6개월이 지나도 소식이 없을 때 전문의 상담을 권해요 (ASRM).',
      '우리나라 모자보건법은 피임 없이 1년이 지나도 임신이 안 되는 경우를 난임으로 봐요.',
      '36세 이상이거나 생리가 불규칙하거나 없다면 1년을 기다리지 말고 더 일찍 상담해 보세요 (NICE).',
      '20~49세라면 결혼 여부와 상관없이 보건소 ‘임신 사전건강관리’로 여성 AMH·초음파, 남성 정액검사 비용을 지원받을 수 있어요.',
    ],
    sources: [SOURCES.asrm2023, SOURCES.mchAct, SOURCES.nice2026, SOURCES.eHealth],
    showWhenHidden: true,
  },
]

/**
 * Sections for the viewer: hidden views skip timing-related sections and use
 * each remaining section's `hiddenPoints` (no 가임기 / date-timing wording).
 */
export function guideSections(hidden: boolean): GuideSection[] {
  if (!hidden) return GUIDE_SECTIONS
  return GUIDE_SECTIONS.filter((s) => s.showWhenHidden).map((s) => (s.hiddenPoints ? { ...s, points: s.hiddenPoints } : s))
}

/** Unique sources across sections, in first-seen order. */
export function guideSources(sections: GuideSection[]): Source[] {
  const seen = new Set<string>()
  const out: Source[] = []
  for (const s of sections)
    for (const src of s.sources) {
      if (seen.has(src.url)) continue
      seen.add(src.url)
      out.push(src)
    }
  return out
}

/**
 * Months of trying after which both partners are encouraged to get checked
 * (ASRM 2023: 12 months under 35, 6 months at 35+). Unknown age → 12.
 */
export function doctorGuideMonths(age: number | undefined): 6 | 12 {
  return age !== undefined && age >= 35 ? 6 : 12
}

/** Personal line for the doctor section, e.g. "지은님(36세) 기준으로는 6개월 동안 …". */
export function doctorAgeLine(name: string, age: number): string {
  const span = doctorGuideMonths(age) === 12 ? '1년' : '6개월'
  return `${name}님(${age}세) 기준으로는 ${span} 동안 소식이 없으면 상담을 받아 보세요.`
}

/** NICE framing shown instead of fertile-day estimates in the hidden view. */
export const NICE_GUIDANCE = {
  title: '날짜 대신, 우리 리듬대로',
  body: '특정 날을 맞추지 않아도 괜찮아요. 주기 전체에 걸쳐 2~3일에 한 번 편하게 함께하는 게 좋고, 규칙적으로 함께하는 커플의 80% 이상이 1년 안에 임신해요.',
  source: SOURCES.nice2026,
} as const

export const ESTIMATE_DISCLAIMER =
  '달력 계산에 기록을 더한 참고용 예상이에요. 피임 목적으로 쓰지 말고, 의학적인 판단은 의사와 상의해 주세요.'
