// Korean public support programs the app points couples to. Amounts and rules
// change almost every year and differ by region, so every item carries its
// effective date and an official link. A production app should serve this from
// a server, not hard-code it. Checked against government pages via search
// summaries on 2026-09-26 (direct .go.kr access was unavailable).

import type { Stage } from '../types'

export interface Program {
  id: string
  stages: Stage[]
  title: string
  /** One-line "what you get". */
  benefit: string
  who: string
  how: string
  /** Deadlines worth a reminder. */
  deadline?: string
  /** When the current rule took effect. */
  effective: string
  url: string
  urlLabel: string
}

export const PROGRAMS_CHECKED_AT = '2026-09-26'

export const PROGRAMS: Program[] = [
  {
    id: 'fertility-check',
    stages: ['preparing'],
    title: '임신 사전건강관리 (가임력 검사비)',
    benefit: '여성 AMH·부인과 초음파 최대 13만 원, 남성 정액검사 최대 5만 원',
    who: '20~49세 남녀 누구나 (결혼·자녀 여부 무관). 나이 구간(~29 / 30~34 / 35~49세)별 1회, 최대 3회',
    how: 'e보건소 또는 주소지 보건소에서 먼저 신청 → 검사의뢰서 받기 → 참여 의료기관에서 검사',
    deadline: '신청 후 3개월 안에 검사, 검사 후 1개월 안에 청구',
    effective: '2025-01-01',
    // The programme's own page (the same link as the 달력 guide, fertility.ts SOURCES.eHealth).
    url: 'https://www.e-health.go.kr/gh/caSrvcGud/selectMdclSupGudInfo.do?heBiz=PG00003&menuId=200097',
    urlLabel: 'e보건소 임신 사전건강관리',
  },
  {
    id: 'folic-acid',
    stages: ['preparing', 'pregnant'],
    title: '보건소 엽산제·철분제',
    benefit: '엽산제 임신 전후 최대 3개월분, 철분제 임신 16주부터(보통 5개월분)',
    who: '임신을 준비하는 여성, 보건소에 등록한 임신부 (지역마다 기준이 조금씩 달라요)',
    how: '주소지 보건소 방문 수령. 임신 중이면 정부24 “맘편한 임신”으로 한 번에 신청',
    effective: '지자체별 운영',
    url: 'https://www.gov.kr/portal/onestopSvc/fertility',
    urlLabel: '정부24 맘편한 임신',
  },
  {
    id: 'infertility',
    stages: ['preparing'],
    title: '난임부부 시술비 지원',
    benefit: '건강보험 본인부담금·비급여의 상당 부분 지원 (출산당 25회: 인공수정 5 · 체외수정 20)',
    // kr-programs.json (사실혼 인정): private guides say a 1-year de facto marriage qualifies; not confirmed in a government document, so only "ask".
    who: '난임 진단을 받은 부부 (소득 기준 없음). 45세 미만 본인부담률 30%. 사실혼 부부는 지자체·보건소에 확인해요',
    how: '주소지 보건소 또는 정부24 신청 → 지원결정통지서 발급',
    deadline: '지원결정통지서 유효기간 6개월 (2026년부터)',
    effective: '2024-11 (출산당 25회), 2026 (통지서 6개월)',
    url: 'https://www.gov.kr/portal/service/serviceInfo/SME000000100',
    urlLabel: '정부24',
  },
  {
    // docs/research/admin-timeline.json (난임치료휴가 연 6일 활용) · kr-programs.json (난임치료휴가):
    // 2025-02-23부터 연 6일(유급 2일), 2026-04 국회 통과 개정으로 2026-11-27부터 유급 4일,
    // 우선지원대상기업은 정부가 최초 4일분 지원. Same facts as roadmap 'pre-infertility-support'.
    id: 'infertility-leave',
    stages: ['preparing'],
    title: '난임치료휴가',
    benefit: '연 6일, 하루 단위 사용 · 2026-11-27부터 유급 4일 (그 전에는 유급 2일)',
    who: '난임 치료를 받는 근로자 (남성도 쓸 수 있어요)',
    how: '회사에 신청해요. 우선지원대상기업(중소기업)은 유급분을 정부가 지원해요 (2026-11-27부터 최초 4일분). 회사마다 절차가 달라요',
    effective: '2025-02-23 (연 6일), 2026-11-27 (유급 4일)',
    // 고용노동부's own 난임치료휴가 card news (kr-programs.json 난임치료휴가 sources).
    url: 'https://www.moel.go.kr/news/cardinfo/view.do?bbs_seq=20250201818',
    urlLabel: '고용노동부 안내',
  },
  {
    id: 'pregnancy-voucher',
    stages: ['pregnant'],
    title: '임신·출산 진료비 (국민행복카드)',
    benefit: '태아 1명당 100만 원 (쌍둥이 200만 원)',
    who: '임신한 건강보험 가입자·피부양자',
    how: '임신 확인 후 카드사·국민건강보험공단 또는 정부24 “맘편한 임신”',
    // kr-programs.json / admin-timeline.json: 분만예정일(출산 후 신청하면 출산일)부터 2년,
    // 유산이면 유산 진단일부터 2년 (review [66]).
    deadline: '분만예정일(출산 뒤 신청하면 출산일)부터 2년 안에 사용. 유산이면 진단일부터 2년',
    effective: '2024-01-01',
    url: 'http://www.voucher.go.kr/voucher/pregnancy.do',
    urlLabel: '사회서비스 전자바우처',
  },
  {
    id: 'first-meeting',
    stages: ['pregnant', 'parenting'],
    title: '첫만남이용권',
    benefit: '첫째 200만 원, 둘째 이상 300만 원 (국민행복카드 바우처)',
    who: '2024년 이후 태어난 아이',
    how: '출생신고 때 정부24 “행복출산” 원스톱으로 함께 신청',
    deadline: '출생일로부터 2년 안에 신청·사용 (2024년 이후 출생아, 남은 금액은 소멸)',
    effective: '2024-01-01',
    url: 'https://www.gov.kr/portal/onestopSvc/happyBirth',
    urlLabel: '정부24 행복출산',
  },
  {
    id: 'parent-allowance',
    stages: ['pregnant', 'parenting'],
    title: '부모급여',
    benefit: '0세 월 100만 원, 1세 월 50만 원 (어린이집 이용 시 보육료 차감)',
    who: '0~1세 아동의 부모',
    how: '정부24 “행복출산”으로 출생신고 때 함께 신청',
    deadline: '출생 후 60일 안에 신청해야 출생월부터 받아요',
    effective: '2024-01-01',
    url: 'https://www.gov.kr/portal/onestopSvc/happyBirth',
    urlLabel: '정부24 행복출산',
  },
  {
    id: 'child-allowance',
    stages: ['parenting'],
    title: '아동수당',
    benefit: '월 10만 원 (비수도권·인구감소지역 추가)',
    who: '만 9세 미만 아동 (2026년 확대)',
    how: '정부24 “행복출산” 또는 주민센터',
    deadline: '출생 후 60일 안에 신청해야 출생월부터 받아요',
    effective: '2026-01 (만 9세 미만으로 확대)',
    url: 'https://www.gov.kr/portal/onestopSvc/happyBirth',
    urlLabel: '정부24 행복출산',
  },
  {
    id: 'infant-checkup',
    stages: ['parenting'],
    title: '영유아 건강검진',
    benefit: '무료 검진 8회 + 구강검진 4회',
    who: '생후 14일 ~ 71개월 영유아',
    how: '검진기관 예약 (국민건강보험공단 안내)',
    effective: '상시',
    url: 'https://www.nhis.or.kr',
    urlLabel: '국민건강보험공단',
  },
  {
    id: 'vaccination',
    stages: ['parenting'],
    title: '어린이 국가예방접종',
    benefit: '국가 지원 백신 무료 접종 + 다음 접종 알림',
    who: '만 12세 이하 어린이',
    how: '예방접종도우미에서 일정 확인, 국민비서로 알림 받기',
    effective: '2026년 국가예방접종 지침',
    url: 'https://nip.kdca.go.kr',
    urlLabel: '예방접종도우미',
  },
]

export function programsFor(stage: Stage): Program[] {
  return PROGRAMS.filter((p) => p.stages.includes(stage))
}

export function programById(id: string): Program | undefined {
  return PROGRAMS.find((p) => p.id === id)
}
