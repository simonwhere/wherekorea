// "챙길 것" roadmap content: what a couple looks after from preparing to the
// first months with the baby — hospitals, tests, vaccines, work rights and
// admin deadlines.
//
// Every fact comes from the checked research notes (medical-checklist,
// admin-timeline, kr-programs; checked 2026-09-26) with their corrections
// applied. Rules and amounts change almost every year and differ by region, so
// each item names its effective date where one exists, keeps its sources, and
// the UI always says to confirm with the care team / company / 보건소.
//
// Windows are in days from an anchor:
//   lmp   — first day of the last period (day 0). "N주 M일" = N*7+M. The 챙길 것
//           view dates it from the due date (due − 280), like the 임신 tab, so a
//           doctor-adjusted due date moves these windows too.
//   edd   — due date. After the birth the 챙길 것 view reads the real birth day
//           here, so rights counted "출산일부터" line up (see lib/logic/plan).
//   birth — birth day (day 0). "N일 안" deadlines use the earliest reading
//           (birth day counted as day 1), like the 60-day claim in lib/logic/babyView.
// Preconception items have no window: there is no date to count from.
// A window without an end stays open until it's ticked (or the birth, for
// pregnancy items): things that are still needed later — a car seat, the
// hospital bag, applications that stay open — never read as "지났어요".

import { CLAIM_KEY, checkupKey } from '../logic/babyView'
import { bagKey, prenatalKey } from '../logic/pregnancyView'
import type { RoadmapTemplate } from '../logic/roadmap'
import { programById } from './programs'

export const ROADMAP_CHECKED_AT = '2026-09-26'

/**
 * Completion shared between two roadmap items that are the same action seen
 * before and after the birth (e.g. 산후도우미 신청: opens 40 days before the
 * due date, closes 60 days after the birth).
 */
export const planKey = (id: string) => `plan:${id}`

/**
 * Deadlines the law counts in calendar months ("1개월 안"), in months from the
 * window's anchor. Windows are in days, so the template itself carries the
 * shortest possible reading (a February birth: 27 days) for any code that reads
 * raw windows; the 챙길 것 view swaps in the exact last day (lib/logic/plan).
 */
export const MONTH_DEADLINES: Readonly<Record<string, number>> = { 'birth-registration': 1 }

/**
 * Things to know or to keep doing (every visit, all pregnancy long, when it
 * applies) rather than one visit to book: no "일정 잡기" — one appointment
 * marked done would tick the whole item.
 */
export const NOT_ONE_APPOINTMENT: ReadonlySet<string> = new Set([
  'pre-work-rules',
  'pre-infertility-support',
  'p1-outpatient-discount',
  'p1-visit-schedule',
  'p1-checkup-time',
  'p1-partner-support',
  'p3-warning-signs',
  'p3-weekly',
])

/** Roadmap item → lib/content/programs id, for the "신청하러 가기" link. */
export const ROADMAP_PROGRAMS: Record<string, string> = {
  'pre-health-check-support': 'fertility-check',
  'pre-checkup-partner': 'fertility-check',
  'pre-folic': 'folic-acid',
  'pre-infertility-support': 'infertility',
  'p1-voucher': 'pregnancy-voucher',
  'p1-health-center': 'folic-acid',
  'p1-flu': 'vaccination',
  'birth-bcg': 'vaccination',
  'birth-happy-birth': 'parent-allowance',
  'pp-infant-checkup-1': 'infant-checkup',
  'pp-vaccine-alerts': 'vaccination',
}

function programLink(itemId: string): RoadmapTemplate['link'] {
  const p = programById(ROADMAP_PROGRAMS[itemId] ?? '')
  return p ? { label: p.urlLabel, url: p.url } : undefined
}

// ── Sources (research URLs) ─────────────────────────────────

const src = (name: string, url: string) => ({ name, url })

const S = {
  eHealth: src(
    'e보건소 임신 사전건강관리',
    'https://www.e-health.go.kr/gh/caSrvcGud/selectMdclSupGudInfo.do?heBiz=PG00003&menuId=200097',
  ),
  easylawPregSupport: src(
    '찾기쉬운 생활법령정보 (임신·출산 지원)',
    'https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=735&ccfNo=1&cciNo=1&cnpClsNo=2',
  ),
  mohwPreconception: src('보건복지부', 'https://www.mohw.go.kr/board.es?mid=a10503000000&bid=0027&list_no=1480886&act=view'),
  childcarePrep: src('임신육아종합포털 아이사랑', 'https://www.childcare.go.kr/?menuno=251'),
  snubhPrep: src('분당서울대학교병원 건강정보', 'https://www.snubh.org/service/info/com/view.do?BNO=464&Board_ID=B004&RNUM=1'),
  acogPrep: src(
    'ACOG 임신 전 상담',
    'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2019/01/prepregnancy-counseling',
  ),
  yaleobgy: src('산부인과 전문의 칼럼 (예일산부인과)', 'https://yaleobgy.co.kr/board/board_view?code=media&no=11'),
  andrology: src('Journal of Andrology (정자 형성 기간)', 'https://onlinelibrary.wiley.com/doi/full/10.2164/jandrol.107.004655'),
  garolla: src('Human Reproduction (사우나와 정자)', 'https://academic.oup.com/humrep/article-abstract/28/4/877/653255'),
  kmaFolic: src('대한의사협회지 (엽산)', 'https://synapse.koreamed.org/upload/synapsedata/pdfdata/0119jkma/jkma-54-799.pdf'),
  gov24Folic: src('정부24 엽산제·철분제 지원', 'https://www.gov.kr/portal/service/serviceInfo/SD0000016094'),
  uspstfFolic: src(
    'USPSTF 엽산 권고',
    'https://www.uspreventiveservicestaskforce.org/uspstf/recommendation/folic-acid-for-the-prevention-of-neural-tube-defects-preventive-medication',
  ),
  nipMmr: src('질병관리청 예방접종도우미 (MMR)', 'https://nip.kdca.go.kr/irhp/infm/goVcntInfo.do?menuLv=1&menuCd=1122'),
  cdcPregVax: src('CDC 임신과 예방접종', 'https://www.cdc.gov/vaccines-pregnancy/hcp/vaccination-guidelines/index.html'),
  immunizeVar: src(
    'Immunize.org (수두)',
    'https://www.immunize.org/ask-experts/topic/varicella/vaccine-recommendations-varicella/',
  ),
  dentalpedia: src('덴탈피디아 (임신과 치과)', 'https://dentalpedia.kr/dentalpedia/?bmode=view&idx=30226602'),
  acogTdap: src(
    'ACOG Tdap 접종',
    'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2017/09/update-on-immunization-and-pregnancy-tetanus-diphtheria-and-pertussis-vaccination',
  ),
  gworkingmomInfertility: src('서울시직장맘지원센터 (난임치료휴가)', 'https://www.gworkingmom.net/network/articles/119'),
  nateInfertility: src('난임치료휴가 개정 보도', 'https://news.nate.com/view/20260423n35039'),
  mohwInfertility: src('보건복지부 (난임 시술비)', 'https://mohw.go.kr/board.es?act=view&bid=0027&list_no=1490515&mid=a10503010100&nPage=1&tag='),
  gov24Infertility: src('정부24 난임부부 시술비 지원', 'https://www.gov.kr/portal/service/serviceInfo/SME000000100'),
  moelPolicy2025: src('고용노동부 (2025 모성보호 개정)', 'https://www.moel.go.kr/policy/policydata/view.do?bbs_seq=20250201644'),
  koreaParental: src('대한민국 정책브리핑 (육아휴직)', 'https://www.korea.kr/news/policyNewsView.do?newsId=148939720'),
  easylawWorkHours: src(
    '찾기쉬운 생활법령정보 (임신기 근로시간 단축)',
    'https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=1112&ccfNo=5&cciNo=1&cnpClsNo=1',
  ),
  gworkingmomWorkHours: src('서울시직장맘지원센터 (근로시간 단축)', 'https://gworkingmom.net/working_parents/maternity/single/11'),
  childcareFirstVisit: src('임신육아종합포털 아이사랑 (임신 확인)', 'https://www.childcare.go.kr/?menuno=358'),
  ibabyFirstVisit: src('베이비뉴스 (첫 진료)', 'https://ibabynews.com/news/articleView.html?idxno=4241'),
  mohwVoucher: src('보건복지부 (2024 임신·출산 지원 확대)', 'https://www.mohw.go.kr/board.es?mid=a10503010200&bid=0027&act=view&list_no=1479667'),
  mohwVoucherMenu: src('보건복지부 임신·출산 진료비 지원', 'https://www.mohw.go.kr/menu.es?mid=a10705020100'),
  gov24Voucher: src('정부24 임신·출산 진료비 지원', 'https://www.gov.kr/portal/service/serviceInfo/SD0000007672'),
  guroRegister: src('구로구 보건소 (임산부 등록)', 'https://www.guro.go.kr/health/contents.do?key=1310'),
  hanamRegister: src('하남시 보건소 (임산부 등록)', 'https://www.hanam.go.kr/health/contents.do?key=953'),
  childcareLabs: src('임신육아종합포털 아이사랑 (산전검사)', 'https://www.childcare.go.kr/?menuno=361'),
  amcPrenatal: src('서울아산병원 (산전 관리)', 'https://www.amc.seoul.kr/asan/mobile/healthinfo/management/managementDetail.do?managementId=58'),
  amcScreening: src('서울아산병원 (기형아 선별검사)', 'https://www.amc.seoul.kr/asan/mobile/healthinfo/management/managementDetail.do?managementId=53'),
  amcGdm: src('서울아산병원 (임신성 당뇨)', 'https://www.amc.seoul.kr/asan/mobile/healthinfo/management/managementDetail.do?managementId=61'),
  hiraOutpatient: src(
    '건강보험심사평가원 (임신부 외래 본인부담)',
    'https://www.hira.or.kr/bbsDummy.do?pgmid=HIRAA020002000100&brdScnBltNo=4&brdBltNo=9866&pageIndex=1',
  ),
  nhisOutpatient: src('국민건강보험공단 (본인부담 경감)', 'https://www.nhis.or.kr/static/html/wbma/c/wbmac0212.html'),
  hiraUltrasound: src('건강보험심사평가원 (산전 초음파)', 'https://www.hira.or.kr/cms/inform/02/1351154_27116.html'),
  casenote74: src(
    '근로기준법 제74조의2',
    'https://casenote.kr/%EB%B2%95%EB%A0%B9/%EA%B7%BC%EB%A1%9C%EA%B8%B0%EC%A4%80%EB%B2%95/%EC%A0%9C74%EC%A1%B0%EC%9D%982',
  ),
  easylawCheckupTime: src(
    '찾기쉬운 생활법령정보 (태아검진 시간)',
    'https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=1379&ccfNo=2&cciNo=2&cnpClsNo=1',
  ),
  monewsDelivery: src('메디칼업저버 (분만 인프라)', 'https://www.monews.co.kr/news/articleView.html?idxno=403383'),
  kdcaNt: src(
    '질병관리청 국가건강정보포털 (1차 선별검사)',
    'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5516',
  ),
  kdcaQuad: src(
    '질병관리청 국가건강정보포털 (2차 선별검사)',
    'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=5515',
  ),
  hankyungCareCenter: src('한국경제 (산후조리원 예약)', 'https://www.hankyung.com/article/2026062335531'),
  knnCareCenter: src('KNN (산후조리원 예약)', 'https://news.knn.co.kr/news/article/163682'),
  economistPublicCare: src('이코노미스트 (공공산후조리원)', 'https://economist.co.kr/article/view/ecn202602030041'),
  mohwCareCost: src('보건복지부 (산후조리원 가격 공개)', 'https://www.mohw.go.kr/board.es?mid=a10503000000&bid=0027&list_no=1484525&act=view'),
  newsisCareCost: src('뉴시스 (산후조리원 평균 가격)', 'https://www.newsis.com/view/NISX20260312_0003546373'),
  consumerRefund: src(
    '한국소비자원 소비자분쟁해결기준',
    'https://www.consumer.go.kr/user/ftc/consumer/trublmdatcase/116/selectTrublMdatCaseView.do?trublMdatCaseSn=11981&page=30&row=25',
  ),
  easylawCareCenter: src(
    '찾기쉬운 생활법령정보 (산후조리원 계약)',
    'https://easylaw.go.kr/CSP/CnpClsMain.laf?ccfNo=3&cciNo=3&cnpClsNo=1&csmSeq=735&popMenu=ov&search_put=',
  ),
  kdcaFlu: src(
    '질병관리청 (2026-27절기 인플루엔자 접종)',
    'https://www.kdca.go.kr/kdca/2848/subview.do?enc=Zm5jdDF8QEB8JTJGYmJzJTJGa2RjYSUyRjQyJTJGMzEyMzA4JTJGYXJ0Y2xWaWV3LmRvJTNG',
  ),
  nipFlu: src('예방접종도우미 (인플루엔자)', 'https://nip.kdca.go.kr/irhp/mngm/goVcntMngm.do?menuLv=3&menuCd=333'),
  insidepeopleSpouse: src('인사이드피플 (배우자 지원 3종)', 'https://www.insidepeople.co.kr/news/article.html?no=773455'),
  segyeSpouse: src('세계일보 (배우자 지원 3종)', 'https://www.segye.com/newsView/20260917513821'),
  heraldSpouse: src('헤럴드경제 (배우자 유산·사산휴가)', 'https://biz.heraldcorp.com/article/10876705'),
  seoulTransport: src('서울시 임신·출산 정보센터 (교통비)', 'https://seoul-agi.seoul.go.kr/pregnant-transportation-support'),
  mtSeoul2026: src('머니투데이 (서울 지원 개정)', 'https://www.mt.co.kr/policy/2026/03/18/2026031810134636045'),
  ksogAnatomy: src('대한산부인과학회', 'https://www.ksog.org/public/index.php?sub=1&third=2'),
  diabetesGdm: src('대한당뇨병학회 (임신성 당뇨)', 'https://diabetes.or.kr/general/info/info_05.php'),
  easylawInsurance: src(
    '찾기쉬운 생활법령정보 (태아보험)',
    'https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=735&ccfNo=2&cciNo=4&cnpClsNo=3',
  ),
  seoulShinmunInsurance: src('서울신문 (태아보험 가입 시기)', 'https://www.seoul.co.kr/news/newsView.php?id=20190516022002'),
  nipTdap: src('질병관리청 예방접종도우미 (Tdap)', 'https://nip.kdca.go.kr/irhp/infm/goVcntInfo.do?menuLv=1&menuCd=1120'),
  acogTdapFaq: src('ACOG Tdap과 임신', 'https://www.acog.org/womens-health/faqs/the-tdap-vaccine-and-pregnancy'),
  mtRsv: src('머니투데이 (RSV 모체 백신 허가)', 'https://www.mt.co.kr/thebio/2026/08/14/2026081414431145987'),
  etnewsRsv: src('전자신문 (RSV 모체 백신 허가)', 'https://www.etnews.com/20260814000268'),
  acogGbs: src(
    'ACOG GBS 예방',
    'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2020/02/prevention-of-group-b-streptococcal-early-onset-disease-in-newborns',
  ),
  kjpGbs: src('Perinatology (국내 GBS 검사)', 'https://e-kjp.org/pdf/10.14734/PN.2024.35.3.85'),
  childcareSigns: src('임신육아종합포털 아이사랑 (위험 신호)', 'https://www.childcare.go.kr/?menuno=267'),
  kdcaSigns: src(
    '질병관리청 국가건강정보포털 (임신 중 위험 신호)',
    'https://health.kdca.go.kr/healthinfo/biz/health/gnrlzHealthInfo/gnrlzHealthInfo/gnrlzHealthInfoView.do?cntnts_sn=3329',
  ),
  khealthBag: src('코메디닷컴 (출산 가방)', 'https://www.k-health.com/news/articleView.html?idxno=86703'),
  easylawCarSeat: src(
    '찾기쉬운 생활법령정보 (영유아 카시트)',
    'https://easylaw.go.kr/CSP/CnpClsMainBtr.laf?ccfNo=1&cciNo=2&cnpClsNo=1&csmSeq=690&popMenu=ov',
  ),
  childcareCarSeat: src('임신육아종합포털 아이사랑 (출산 준비)', 'https://www.childcare.go.kr/?menuno=266'),
  babytimesWorkHours: src('베이비타임즈 (32주 근로시간 단축)', 'https://www.babytimes.co.kr/news/articleView.html?idxno=69605'),
  easylawMaternity: src(
    '찾기쉬운 생활법령정보 (출산전후휴가)',
    'https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=1112&ccfNo=5&cciNo=2&cnpClsNo=1',
  ),
  gov24Maternity: src('정부24 출산전후휴가 급여', 'https://www.gov.kr/portal/service/serviceInfo/WII000001460'),
  easylawEarlyLeave: src(
    '찾기쉬운 생활법령정보 (출산전후휴가 분할 사용)',
    'https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=1379&ccfNo=3&cciNo=1&cnpClsNo=1',
  ),
  babytimesParental: src('베이비타임즈 (육아휴직 급여)', 'https://www.babytimes.co.kr/news/articleView.html?idxno=69206'),
  easylawParental: src(
    '찾기쉬운 생활법령정보 (육아휴직)',
    'https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=1112&ccfNo=5&cciNo=2&cnpClsNo=2',
  ),
  gov24Postnatal: src('정부24 산모·신생아 건강관리 지원', 'https://www.gov.kr/mw/AA020InfoCappView.do?CappBizCD=13520000043'),
  gwanakPostnatal: src('관악구 보건소 (산모·신생아 건강관리)', 'https://www.gwanak.go.kr/site/health/04/10402020000002016051301.jsp'),
  gjcityPostnatal: src('광주시 (산모·신생아 건강관리 예외지원)', 'https://www.gjcity.go.kr/depart/contents.do?mId=0805070100'),
  easylawSpouseLeave: src(
    '찾기쉬운 생활법령정보 (배우자 출산휴가)',
    'https://m.easylaw.go.kr/MOB/NtcInfoRetrieve.laf?ntcSeq=1630&targetRow=41&sch=&type=TTL',
  ),
  seoulShinmunSpouse: src('서울신문 (배우자 출산휴가 예정일 전 사용)', 'https://www.seoul.co.kr/news/society/2026/09/18/20260918008002'),
  nipHepB: src('질병관리청 예방접종도우미 (B형간염)', 'https://nip.kdca.go.kr/irhp/infm/goVcntInfo.do?menuLv=1&menuCd=1102'),
  nipPerinatalHepB: src('예방접종도우미 (B형간염 주산기감염 예방)', 'https://nip.kdca.go.kr/irhp/infm/goVcntInfo.do?menuLv=1&menuCd=133'),
  seoulMetabolic: src('서울시 임신·출산 정보센터 (선천성대사이상)', 'https://seoul-agi.seoul.go.kr/metabolic-screening'),
  snuhMetabolic: src('서울대학교병원 의학정보', 'https://www.snuh.org/health/nMedInfo/nView.do?category=TEST&medid=BA000078'),
  hearing: src('신생아 청각선별검사 사업', 'https://www.hearingscreening.or.kr/'),
  easylawHearing: src(
    '찾기쉬운 생활법령정보 (신생아 청각검사)',
    'https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=735&ccfNo=3&cciNo=4&cnpClsNo=2',
  ),
  nipBcg: src('질병관리청 예방접종도우미 (BCG)', 'https://nip.kdca.go.kr/irhp/infm/goVcntInfo.do?menuLv=1&menuCd=1101'),
  easylawBirthReport: src(
    '찾기쉬운 생활법령정보 (출생신고)',
    'https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=707&ccfNo=2&cciNo=1&cnpClsNo=1',
  ),
  hiraBirthNotice: src(
    '건강보험심사평가원 (출생통보제)',
    'https://www.hira.or.kr/bbsDummy.do?pgmid=HIRAA020002000100&brdScnBltNo=4&brdBltNo=11013&pageIndex=1&pageIndex2=1',
  ),
  gov24HappyBirth: src('정부24 행복출산 원스톱서비스', 'https://www.gov.kr/portal/service/serviceInfo/174000000029'),
  koreaHappyBirth: src('대한민국 정책브리핑 (행복출산)', 'https://www.korea.kr/news/policyNewsView.do?newsId=148933586'),
  koreaParentAllowance: src('대한민국 정책브리핑 (부모급여)', 'https://www.korea.kr/news/policyNewsView.do?newsId=148924684'),
  mohwChildAllowance: src(
    '보건복지부 (아동수당 확대)',
    'https://www.mohw.go.kr/board.es?mid=a10503010100&bid=0027&act=view&list_no=1490257&tag=&nPage=1',
  ),
  nhisDependent: src('국민건강보험공단 (피부양자)', 'https://www.nhis.or.kr/static/html/wbdb/f/wbdbf0301.html'),
  gov24Dependent: src('정부24 피부양자 자격 취득 신고', 'https://www.gov.kr/mw/AA020InfoCappView.do?HighCtgCD=A05007&CappBizCD=14600000233'),
  mohwInfantCheckup: src(
    '보건복지부 (영유아 건강검진 8차)',
    'https://www.mohw.go.kr/board.es?mid=a10503010100&bid=0027&act=view&list_no=362391&tag=&nPage=268',
  ),
  doctorsnewsCheckup: src('의협신문 (영유아 건강검진)', 'https://www.doctorsnews.co.kr/news/articleView.html?idxno=137486'),
  acogPostpartum: src(
    'ACOG 산후 관리',
    'https://www.acog.org/clinical/clinical-guidance/committee-opinion/articles/2018/05/optimizing-postpartum-care',
  ),
  easylawPostpartum: src(
    '찾기쉬운 생활법령정보 (산후 건강관리)',
    'https://easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=735&ccfNo=3&cciNo=5&cnpClsNo=2',
  ),
  nip: src('질병관리청 예방접종도우미', 'https://nip.kdca.go.kr/'),
  nipAlerts: src('예방접종도우미 (알림 서비스)', 'https://nip.kdca.go.kr/irhp/mngm/goVcntMngm.do?menuLv=3&menuCd=313'),
  seoulPostpartumCost: src('서울시 임신·출산 정보센터 (산후조리경비)', 'https://seoul-agi.seoul.go.kr/postpartum-care'),
  moelSixSix: src(
    '고용노동부 (6+6 부모육아휴직제)',
    'https://www.moel.go.kr/minwon/fastcounsel/fastcounselView.do?inetDcssMngId=202412180232020520901',
  ),
  koreaSixSix: src('대한민국 정책브리핑 (6+6)', 'https://www.korea.kr/news/policyNewsView.do?newsId=148926593'),
  easylawHighRisk: src(
    '찾기쉬운 생활법령정보 (고위험 임산부 의료비)',
    'https://www.easylaw.go.kr/CSP/CnpClsMain.laf?popMenu=ov&csmSeq=735&ccfNo=2&cciNo=2&cnpClsNo=4',
  ),
  seoulHighRisk: src('서울시 임신·출산 정보센터 (고위험 임산부)', 'https://seoul-agi.seoul.go.kr/highrisk-pregnancy-support'),
  passport: src('외교부 여권안내', 'https://www.passport.go.kr/home/kor/contents.do?menuPos=4'),
  ibabyPassport: src('베이비뉴스 (아기 여권)', 'https://www.ibabynews.com/news/articleView.html?idxno=117886'),
} as const

const LINK = {
  moel: { label: '고용노동부', url: 'https://www.moel.go.kr' },
  bokjiro: { label: '복지로', url: 'https://www.bokjiro.go.kr' },
  nhis: { label: '국민건강보험공단', url: 'https://www.nhis.or.kr' },
  nip: { label: '예방접종도우미', url: 'https://nip.kdca.go.kr' },
  seoulAgi: { label: '서울시 임신·출산 정보센터', url: 'https://seoul-agi.seoul.go.kr' },
  passport: { label: '외교부 여권안내', url: 'https://www.passport.go.kr' },
} as const

// ── Templates ───────────────────────────────────────────────

const TEMPLATES: RoadmapTemplate[] = [
  // ── 임신 준비 ─────────────────────────────────────────────
  {
    id: 'pre-health-check-support',
    phase: 'preconception',
    who: 'both',
    kind: 'test',
    title: '임신 사전건강관리 검사 지원 신청',
    when: '임신 계획 3~6개월 전',
    // kr-programs.json: the support counts per person ('부부 각각 나이 주기별'); whether one
    // application covers both people is still to be confirmed (STATUS N18) — so "확인해요".
    detail:
      '20~49세라면 결혼 여부와 상관없이 여성은 AMH·부인과 초음파 최대 13만 원, 남성은 정액검사 최대 5만 원을 나이 구간(29세 이하·30~34세·35~49세)마다 1회씩, 최대 3회 지원받아요(2026년 기준). 지원은 사람마다 따로 세요 — 각자 이름으로 신청하는지 보건소에 확인해요. 검사 전에 e보건소나 보건소에서 먼저 신청해야 하고, 먼저 검사한 뒤 청구하는 소급 지원은 안 돼요. 신청 후 3개월 안에 검사하고, 검사 후 1개월 안에 청구해요.',
    sources: [S.eHealth, S.easylawPregSupport, S.mohwPreconception],
  },
  {
    id: 'pre-checkup-carrier',
    phase: 'preconception',
    who: 'carrier',
    kind: 'test',
    title: '임신 전 기본 검사 (혈액·소변·자궁경부암)',
    when: '임신 계획 3개월 전',
    detail:
      '빈혈, 혈액형(Rh 포함), 풍진 항체, B형간염, 매독·HIV, 갑상선, 공복혈당, 소변검사를 받아 두고, 항체가 없는 감염병은 임신 전에 접종해요. 자궁경부암 검진은 20세 이상 여성이 2년마다 국가암검진으로 받을 수 있어요. 검사 항목은 병원마다 조금씩 달라요.',
    sources: [S.childcarePrep, S.snubhPrep, S.acogPrep],
  },
  {
    id: 'pre-checkup-partner',
    phase: 'preconception',
    who: 'partner',
    kind: 'test',
    title: '임신 전 검사 (정액·감염병)',
    when: '임신 계획 3개월 전',
    // kr-programs.json '신청과 환급 절차': referral → a participating clinic within 3 months →
    // claim within 1 month with 청구서·영수증·세부내역서·통장사본.
    detail:
      '정액검사는 보건소 임신 사전건강관리로 최대 5만 원까지 지원돼요(검사 전에 신청, 차액은 본인 부담). 검사의뢰서를 들고 사업에 참여하는 의료기관에서 받고, 검사 후 1개월 안에 청구서·영수증·세부내역서·통장사본으로 청구해요. 혈액·소변검사, 매독·HIV, B·C형 간염과 간 기능, 흉부 X선(결핵)도 함께 받아 두길 권해요.',
    sources: [S.eHealth, S.yaleobgy],
  },
  {
    id: 'pre-habits-partner',
    phase: 'preconception',
    who: 'partner',
    kind: 'habit',
    title: '금연·금주, 3개월 전부터',
    when: '임신 시도 3개월 전부터',
    detail:
      '정자가 만들어지는 데 약 64~74일, 성숙하는 데 1~2주가 더 걸려 모두 3개월쯤 필요해요. 그래서 생활습관은 3개월 전부터 바꾸는 게 좋아요. 사우나·뜨거운 탕처럼 고환 온도를 높이는 환경도 잠시 쉬어요.',
    sources: [S.andrology, S.garolla],
  },
  {
    id: 'pre-folic',
    phase: 'preconception',
    who: 'carrier',
    kind: 'habit',
    title: '엽산 챙겨 먹기 (보건소 무료 지원)',
    when: '임신 2~3개월 전부터 임신 12주까지',
    detail:
      '신경관결손 예방을 위해 임신 전부터 임신 12주까지 하루 400μg 이상 엽산을 먹는 것이 표준 권고예요. 보건소에서 임신을 준비하는 여성에게 최대 3개월분을 무료로 줘요(보건소마다 기준이 조금씩 달라요).',
    sources: [S.kmaFolic, S.gov24Folic, S.uspstfFolic],
  },
  {
    id: 'pre-rubella',
    phase: 'preconception',
    who: 'carrier',
    kind: 'vaccine',
    title: '풍진(MMR) 항체 확인·접종',
    when: '임신 시도 1~2개월 전까지',
    detail:
      '임신 중 풍진에 걸리면 선천성 풍진증후군(난청·백내장·심장 기형)이 생길 수 있어요. 항체가 없으면 임신 전에 MMR을 맞는데, 생백신이라 임신 중엔 맞을 수 없고 접종 후 4주(28일)는 임신을 미루도록 안내해요(질병관리청·CDC).',
    sources: [S.nipMmr, S.cdcPregVax],
  },
  {
    id: 'pre-varicella',
    phase: 'preconception',
    who: 'carrier',
    kind: 'vaccine',
    title: '수두 면역 확인·접종',
    when: '임신 시도 2~3개월 전 (2회 접종 기간 확보)',
    detail:
      '수두를 앓은 적이 없거나 항체가 없으면 임신 전에 4~8주 간격으로 2회 맞아요. 생백신이라 임신 중엔 맞을 수 없고, CDC는 접종할 때마다 1개월은 임신을 미루도록 안내해요. 국내 자료 중엔 더 긴 기간을 권하는 곳도 있으니 담당의와 확인하세요.',
    sources: [S.cdcPregVax, S.immunizeVar],
  },
  {
    id: 'pre-hepb',
    phase: 'preconception',
    who: 'both',
    kind: 'vaccine',
    title: 'B형간염 항체 확인·접종',
    when: '임신 계획 6개월 전쯤이 좋아요',
    detail:
      'B형간염 항원·항체가 모두 음성이면 0·1·6개월 일정으로 3회 맞아요. 불활성화 백신이라 도중에 임신해도 이어서 접종할 수 있어요.',
    sources: [S.snubhPrep, S.cdcPregVax],
  },
  {
    id: 'pre-dental',
    phase: 'preconception',
    who: 'both',
    kind: 'hospital',
    title: '치과 검진·스케일링',
    when: '임신 계획 3~6개월 전',
    detail:
      '임신하면 호르몬 변화로 잇몸 염증이 늘고, 입덧 때문에 구강 관리가 어려워질 수 있어요. 치료는 임신 전에 끝내 두는 게 좋고, 임신 중에 치료가 필요하면 비교적 안전한 중기(16~28주)에 받아요.',
    sources: [S.dentalpedia],
  },
  {
    id: 'pre-partner-vaccines',
    phase: 'preconception',
    who: 'partner',
    kind: 'vaccine',
    title: '예방접종 점검 (MMR·수두·A·B형간염·독감)',
    when: '임신 계획 단계',
    detail:
      '가족이 감염돼 임신부에게 옮기지 않도록 접종력과 항체를 확인하고, 빠진 접종은 맞아 둬요. 독감은 매년 가을에 맞고, 신생아를 위한 Tdap은 출산 전에 따로 챙겨요.',
    sources: [S.yaleobgy, S.acogTdap],
  },
  {
    id: 'pre-infertility-support',
    phase: 'preconception',
    who: 'both',
    kind: 'admin',
    title: '난임 치료가 필요할 때 (휴가·시술비 지원)',
    when: '필요할 때',
    detail:
      '난임치료휴가는 연 6일(유급 2일)이고 남성도 쓸 수 있어요(2025-02-23부터). 2026-11-27부터는 유급이 4일로 늘어나요. 시술비는 난임 진단 뒤 보건소나 정부24에서 신청하고, 소득 기준 없이 출산당 25회까지 지원돼요.',
    sources: [S.gworkingmomInfertility, S.nateInfertility, S.mohwInfertility, S.gov24Infertility],
  },
  {
    id: 'pre-work-rules',
    phase: 'preconception',
    who: 'both',
    kind: 'work',
    title: '회사의 임신·출산·육아 제도 살펴보기',
    when: '임신 준비 중 언제든',
    detail:
      '2025-02-23 개정으로 배우자 출산휴가 20일, 육아휴직 최대 1년 6개월(부모가 각각 3개월 이상 쓸 때), 임신기 근로시간 단축(12주 이내·32주 이후)이 정해졌어요. 신청 절차와 운영 방식은 회사마다 다르니 미리 확인해 두면 든든해요.',
    sources: [S.moelPolicy2025, S.koreaParental, S.easylawWorkHours],
    link: LINK.moel,
  },

  // ── 임신 초기 ─────────────────────────────────────────────
  {
    id: 'p1-first-visit',
    phase: 'pregnancy-1st',
    who: 'both',
    kind: 'hospital',
    title: '첫 산부인과 진료 · 임신확인서',
    when: '임신 5~8주 무렵',
    window: { anchor: 'lmp', start: 35, end: 62 },
    milestoneKey: prenatalKey('first-visit'),
    detail:
      '임신 5~6주쯤 질 초음파로 아기집이 보이고, 심장 박동은 보통 6~7주에 확인해요. 임신확인서를 언제 발급하는지는 병원마다 달라요. 국민행복카드 신청과 보건소 등록에 필요해요.',
    sources: [S.childcareFirstVisit, S.ibabyFirstVisit],
  },
  {
    id: 'p1-work-hours',
    phase: 'pregnancy-1st',
    who: 'carrier',
    kind: 'work',
    title: '임신기 근로시간 단축 (12주 이내)',
    when: '임신 12주(84일) 이내 · 시작 3일 전까지 신청',
    // 84th day counting the LMP as day 1 = LMP + 83.
    window: { anchor: 'lmp', start: 0, end: 83 },
    detail:
      '임신 12주 이내와 32주 이후에는 임금 삭감 없이 하루 2시간 단축을 신청할 수 있어요(하루 8시간 미만 근무면 6시간까지). 시작 3일 전까지 의사 진단서와 함께 회사에 신청하고, 2025-02-23부터 고위험 임신부는 임신 기간 내내 쓸 수 있어요.',
    sources: [S.moelPolicy2025, S.easylawWorkHours, S.gworkingmomWorkHours],
    link: LINK.moel,
  },
  {
    id: 'p1-voucher',
    phase: 'pregnancy-1st',
    who: 'carrier',
    kind: 'admin',
    title: '국민행복카드 (임신·출산 진료비) 신청',
    when: '임신확인서를 받은 뒤',
    // Stays open: the card can be applied for later in pregnancy (or after the birth).
    window: { anchor: 'lmp', start: 42 },
    milestoneKey: prenatalKey('voucher'),
    detail:
      '태아 1명당 100만 원(쌍둥이 200만 원, 2024-01부터)이고, 분만취약지에 살면 20만 원이 더해져요. 출산 전에 신청하면 분만예정일부터 2년 동안 임산부 진료비와 2세 미만 아기 진료비·약값에 쓸 수 있어요.',
    sources: [S.mohwVoucher, S.mohwVoucherMenu, S.gov24Voucher],
  },
  {
    id: 'p1-health-center',
    phase: 'pregnancy-1st',
    who: 'carrier',
    kind: 'admin',
    title: '보건소 임신부 등록 (산모수첩·엽산·철분제)',
    when: '임신 확인 후',
    window: { anchor: 'lmp', start: 42 },
    milestoneKey: prenatalKey('health-center'),
    detail:
      '임신확인서와 신분증을 가지고 등록하면 산모수첩, 임산부 배지, 엽산제를 받을 수 있어요. 철분제는 임신 16주 이후 분만 전까지 최대 5개월분이 지원돼요. 산전검사 무료 같은 추가 혜택은 보건소마다 달라요.',
    sources: [S.gov24Folic, S.guroRegister, S.hanamRegister],
  },
  {
    id: 'p1-prenatal-labs',
    phase: 'pregnancy-1st',
    who: 'carrier',
    kind: 'test',
    title: '임신 초기 산전검사 (혈액·소변)',
    when: '첫 진료 ~ 임신 12주 전후',
    window: { anchor: 'lmp', start: 42, end: 90 },
    detail:
      '빈혈, 혈액형, B형간염, HIV, 매독, 풍진 항체, 소변검사를 받고, 병원에 따라 갑상선·간 기능·C형간염 검사가 더해져요. 매독 같은 감염은 일찍 찾아 치료할수록 아기에게 옮을 위험이 크게 줄어요.',
    sources: [S.childcareLabs, S.amcPrenatal],
  },
  {
    id: 'p1-birth-hospital',
    phase: 'pregnancy-1st',
    who: 'both',
    kind: 'hospital',
    title: '분만 병원 정하기',
    when: '임신 초기 ~ 중기 초',
    window: { anchor: 'lmp', start: 42 },
    detail:
      '다니는 산부인과에서 실제로 분만을 하는지, 24시간 분만·무통분만 체계와 신생아집중치료실(NICU) 또는 전원 체계가 있는지 확인해요. 밤에 병원까지 걸리는 시간도 봐 두고, 분만하는 병원이 줄고 있어 일찍 정해 두면 안심이에요.',
    sources: [S.monewsDelivery],
  },
  {
    id: 'p1-nt',
    phase: 'pregnancy-1st',
    who: 'carrier',
    kind: 'test',
    title: 'NT(목덜미 투명대) · 1차 기형아 선별검사',
    when: '임신 11주 ~ 13주 6일',
    window: { anchor: 'lmp', start: 77, end: 97 },
    milestoneKey: prenatalKey('nt'),
    detail:
      '초음파로 목덜미 두께를 재고 혈액으로 PAPP-A·hCG를 검사해 염색체 이상 위험을 평가하는 선별검사예요. 검사할 수 있는 기간이 짧아서 11주 전후 진료 때 미리 예약해요.',
    sources: [S.kdcaNt, S.amcScreening],
  },
  {
    id: 'p1-care-center',
    phase: 'pregnancy-1st',
    who: 'both',
    kind: 'prep',
    title: '산후조리원 알아보기 · 예약',
    when: '임신 8~12주 무렵',
    window: { anchor: 'lmp', start: 56, end: 84 },
    detail:
      '공식 통계는 없지만 인기 조리원은 임신 8~10주, 빠르면 6~8주에 마감된다는 경험담이 많아요. 두세 곳을 비교하고 취소 대기도 함께 걸어 두면 좋아요. 공공산후조리원(2025년 말 전국 25곳)은 대체로 민간의 절반 수준 비용이라 경쟁이 치열하고 예약 방식이 지자체마다 달라서 일찍 확인해요.',
    sources: [S.hankyungCareCenter, S.knnCareCenter, S.economistPublicCare],
  },
  {
    id: 'p1-care-center-contract',
    phase: 'pregnancy-1st',
    who: 'both',
    kind: 'admin',
    title: '조리원 계약 전 비용·환불 기준 확인',
    when: '계약금을 내기 전',
    window: { anchor: 'lmp', start: 56, end: 97 },
    detail:
      '보건복지부 공개 자료(2025년 12월 말 기준)로 일반실 평균은 372만 원, 특실 평균은 543만 원이에요. 소비자분쟁해결기준상 입소예정일 31일 전까지 또는 계약 후 24시간 안에 해지하면 계약금을 모두 돌려받고, 21~30일 전은 60%, 10~20일 전은 30%, 9일 전부터는 돌려받지 못해요.',
    sources: [S.mohwCareCost, S.newsisCareCost, S.consumerRefund, S.easylawCareCenter],
  },
  {
    id: 'p1-outpatient-discount',
    phase: 'pregnancy-1st',
    who: 'carrier',
    kind: 'admin',
    title: '임신부 외래 진료비 경감 확인',
    when: '임신 확인 후 외래 진료 때마다',
    detail:
      '2017-01-01부터 임신부의 외래 본인부담률은 의원 10%, 병원 20%, 종합병원 30%, 상급종합병원 40%로 일반보다 20%p 낮아요. 접수할 때 임신 사실을 알리고 적용됐는지 확인해요.',
    sources: [S.hiraOutpatient, S.nhisOutpatient],
  },
  {
    id: 'p1-visit-schedule',
    phase: 'pregnancy-1st',
    who: 'both',
    kind: 'hospital',
    title: '정기 검진 주기 알아두기',
    when: '임신 기간 내내',
    detail:
      '보통 임신 28주까지 4주마다, 36주까지 2주마다, 그 뒤로는 매주 진료를 받고, 고위험 임신이면 더 자주 가요. 산전 초음파는 주수 구간별로 건강보험 적용 횟수가 정해져 있고, 정밀초음파 1회를 포함해 총 7회 정도로 알려져 있어요. 병원마다 다를 수 있어요.',
    sources: [S.amcPrenatal, S.hiraUltrasound],
  },
  {
    id: 'p1-checkup-time',
    phase: 'pregnancy-1st',
    who: 'carrier',
    kind: 'work',
    title: '태아검진 시간 (유급) 청구',
    when: '임신 기간 내내, 검진 때마다',
    detail:
      '근로기준법 제74조의2에 따라 임신 28주까지 4주마다, 29~36주는 2주마다, 37주 이후는 매주 1회 검진 시간을 청구할 수 있고, 그 시간만큼 임금을 깎을 수 없어요. 병원 왕복과 검진에 필요한 시간이 포함돼요.',
    sources: [S.casenote74, S.easylawCheckupTime],
    link: LINK.moel,
  },
  {
    id: 'p1-flu',
    phase: 'pregnancy-1st',
    who: 'carrier',
    kind: 'vaccine',
    title: '임신부 독감 무료 접종 (2026-27절기)',
    when: '2026.9.21 ~ 2027.4.30 · 임신 주수와 상관없이',
    detail:
      '2026-27절기에는 임신부라면 주수와 상관없이 2026-09-21부터 2027-04-30까지 무료로 맞을 수 있어요. 주소지와 상관없이 전국 위탁의료기관과 보건소에서 맞을 수 있으니 산모수첩이나 임신확인서를 챙겨 가요.',
    sources: [S.kdcaFlu, S.nipFlu],
  },
  {
    id: 'p1-partner-support',
    phase: 'pregnancy-1st',
    who: 'partner',
    kind: 'work',
    title: '임신 중 배우자 지원 제도 (2026-09-18 시행)',
    when: '필요할 때',
    detail:
      '임신 중인 배우자에게 유산·조산 위험이 있으면 출생 전에도 육아휴직을 쓸 수 있어요(시작 7일 전까지 신청, 전체 육아휴직 기간에서 빠져요). 만약의 경우를 위한 배우자 유산·사산휴가 5일(처음 3일 유급)도 생겼고, 20일 안에 청구해요.',
    sources: [S.insidepeopleSpouse, S.segyeSpouse, S.heraldSpouse],
    link: LINK.moel,
  },
  {
    id: 'p1-transport',
    phase: 'pregnancy-1st',
    who: 'carrier',
    kind: 'admin',
    title: '지자체 임산부 교통비 (예: 서울)',
    when: '서울 기준 임신 12주 ~ 출산 후 3개월 안에 신청',
    detail:
      '서울은 2026-01-01 신청분부터 첫째 70만 원, 둘째 80만 원, 셋째 이상 100만 원을 대중교통·택시·유류비 등에 쓰는 카드 바우처로 지원해요. 금액과 신청 기간은 지자체마다 달라요.',
    sources: [S.seoulTransport, S.mtSeoul2026],
    link: LINK.seoulAgi,
  },

  // ── 임신 중기 ─────────────────────────────────────────────
  {
    id: 'p2-quad',
    phase: 'pregnancy-2nd',
    who: 'carrier',
    kind: 'test',
    title: '2차 기형아 선별검사 (쿼드) · NIPT 선택',
    when: '쿼드 임신 15~20주 (NIPT는 10주 이후)',
    window: { anchor: 'lmp', start: 105, end: 146 },
    milestoneKey: prenatalKey('quad'),
    detail:
      '쿼드검사는 혈액으로 다운증후군·에드워드증후군·신경관결손 위험을 보는 선별검사로, 보통 1차 검사와 묶어 통합·순차 검사로 해요. NIPT도 선별검사라서 결과가 양성이면 융모막·양수검사로 확인해요.',
    sources: [S.kdcaQuad, S.amcScreening],
  },
  {
    id: 'p2-anatomy',
    phase: 'pregnancy-2nd',
    who: 'both',
    kind: 'test',
    title: '정밀초음파',
    when: '임신 20~24주',
    window: { anchor: 'lmp', start: 140, end: 167 },
    milestoneKey: prenatalKey('anatomy'),
    detail:
      '주요 선천성 기형(신생아의 약 2~3%)을 일찍 찾기 위해 아기 몸의 구조를 자세히 보는 검사예요. 건강보험은 16주 이후 1회 적용되고, 예약이 차는 경우가 많아 미리 잡아요. 둘이 함께 가기 좋은 날이에요.',
    sources: [S.ksogAnatomy, S.hiraUltrasound],
  },
  {
    id: 'p2-gdm',
    phase: 'pregnancy-2nd',
    who: 'carrier',
    kind: 'test',
    title: '임신성 당뇨 검사',
    when: '임신 24~28주',
    window: { anchor: 'lmp', start: 168, end: 195 },
    milestoneKey: prenatalKey('gdm'),
    detail:
      '모든 임신부가 받는 검사예요. 50g 포도당을 마시고 1시간 뒤 혈당이 기준(보통 140mg/dL, 병원에 따라 130 또는 135) 이상이면 100g 검사로 확인하고, 75g 검사로 한 번에 보는 병원도 있어요.',
    sources: [S.diabetesGdm, S.amcGdm],
  },
  {
    id: 'p2-dental',
    phase: 'pregnancy-2nd',
    who: 'carrier',
    kind: 'hospital',
    title: '치과 치료가 필요하면 중기에',
    when: '임신 16~28주',
    window: { anchor: 'lmp', start: 112, end: 195 },
    detail:
      '임신 중에는 호르몬 변화로 잇몸 염증이 늘 수 있어요. 치료가 필요하면 비교적 안전한 중기(16~28주)에 받아요.',
    sources: [S.dentalpedia],
  },
  {
    id: 'p2-fetal-insurance',
    phase: 'pregnancy-2nd',
    who: 'both',
    kind: 'prep',
    title: '태아보험 가입 여부 정하기',
    when: '보통 임신 22주 전 (상품마다 달라요)',
    window: { anchor: 'lmp', start: 98, end: 153 },
    detail:
      '업계에서는 22주가 지나면 선천이상·저체중아 같은 태아 특약 가입이 어렵다고 안내하는데, 법정 기한이 아니라 상품별 기준이에요. 필요한지부터 둘이 편하게 이야기해 보세요. 둘셋은 특정 상품을 추천하지 않아요.',
    sources: [S.easylawInsurance, S.seoulShinmunInsurance],
  },

  // ── 임신 후기 ─────────────────────────────────────────────
  {
    id: 'p3-tdap',
    phase: 'pregnancy-3rd',
    who: 'carrier',
    kind: 'vaccine',
    title: '임신부 Tdap(백일해) 접종',
    when: '임신 27~36주, 임신할 때마다',
    window: { anchor: 'lmp', start: 189, end: 251 },
    detail:
      '임신 중에 맞으면 항체가 아기에게 전해져, 아기가 첫 접종을 받는 생후 2개월까지 백일해를 막아 줘요. 예전에 맞았더라도 임신할 때마다 1회 맞아요(질병관리청·ACOG). 비용은 병원·보건소에 확인하세요.',
    sources: [S.nipTdap, S.acogTdapFaq],
  },
  {
    id: 'p3-partner-tdap',
    phase: 'pregnancy-3rd',
    who: 'partner',
    kind: 'vaccine',
    title: 'Tdap(백일해) 접종, 아기 만나기 2주 전까지',
    when: '예정일 2주 전까지 (임신 후기 초반이면 안심)',
    window: { anchor: 'edd', start: -60, end: -14 },
    detail:
      'Tdap을 맞은 적이 없는 가족(배우자·조부모)이나 산후도우미처럼 아기와 가까이 지낼 사람은 만나기 최소 2주 전까지 1회 맞아요. 아기가 예정일보다 일찍 태어날 수도 있어 임신 후기 초반에 맞아 두면 안심이에요.',
    sources: [S.acogTdap, S.nipTdap],
  },
  {
    id: 'p3-rsv',
    phase: 'pregnancy-3rd',
    who: 'carrier',
    kind: 'vaccine',
    title: 'RSV 모체 백신 상담',
    when: '임신 28~36주 (국내 허가 기준)',
    window: { anchor: 'lmp', start: 196, end: 258 },
    detail:
      '임신 28~36주에 1회 맞는 RSV 모체 백신이 2026-08-13 국내 허가를 받았어요. 생후 6개월까지 아기의 RSV 하기도 질환을 예방하기 위한 백신이에요. 국가접종 포함 여부와 비용은 확인되지 않았으니 담당 의료진과 상의하세요.',
    sources: [S.mtRsv, S.etnewsRsv],
  },
  {
    id: 'p3-gbs',
    phase: 'pregnancy-3rd',
    who: 'carrier',
    kind: 'test',
    title: 'GBS(B군 연쇄상구균) 검사',
    when: '임신 35~37주',
    window: { anchor: 'lmp', start: 245, end: 265 },
    milestoneKey: prenatalKey('gbs'),
    detail:
      '질·항문 배양검사로 보균 여부를 확인하고, 양성이면 분만 중 항생제를 맞아 아기 감염을 막아요. 국내에서는 모든 임신부가 받는 검사가 아니라 병원마다 방침이 달라서, 검사하는지 담당의에게 물어보세요.',
    sources: [S.acogGbs, S.kjpGbs],
  },
  {
    id: 'p3-weekly',
    phase: 'pregnancy-3rd',
    who: 'carrier',
    kind: 'hospital',
    title: '36주부터 매주 진료',
    when: '임신 36주 ~ 출산',
    window: { anchor: 'lmp', start: 252 },
    milestoneKey: prenatalKey('weekly'),
    detail: '보통 36주가 지나면 매주 진료를 받아요. 고위험 임신이면 더 자주 가고, 병원마다 다를 수 있어요.',
    sources: [S.amcPrenatal],
  },
  {
    id: 'p3-warning-signs',
    phase: 'pregnancy-3rd',
    who: 'both',
    kind: 'prep',
    title: '바로 병원에 연락할 신호 같이 알아두기',
    when: '임신 28주 무렵 (임신 기간 내내 해당돼요)',
    window: { anchor: 'lmp', start: 196 },
    detail:
      '출혈(특히 복통과 함께), 양수가 새는 느낌, 규칙적인 진통(첫 출산은 보통 5~10분 간격), 28주 이후 태동이 뚜렷이 줄어들 때는 바로 병원에 연락해요. 심한 두통, 시야 이상, 윗배 통증도 바로 알려야 할 신호예요.',
    sources: [S.childcareSigns, S.kdcaSigns],
  },
  {
    id: 'p3-hospital-bag',
    phase: 'pregnancy-3rd',
    who: 'both',
    kind: 'prep',
    title: '출산 가방·서류 챙기기',
    when: '임신 30주에 시작, 34~36주에 완성',
    window: { anchor: 'lmp', start: 210 },
    detail:
      '37주부터 만삭이고 그 전에도 진통이 올 수 있어 34~36주에는 가방을 완성해 둬요. 신분증·국민행복카드·산모수첩은 따로 챙기고, 밤에 병원 가는 길도 둘이 미리 정해 둬요. 임신 탭의 출산 가방 목록을 같이 써 보세요.',
    sources: [S.khealthBag],
  },
  {
    id: 'p3-car-seat',
    phase: 'pregnancy-3rd',
    who: 'both',
    kind: 'prep',
    title: '카시트 미리 설치하기',
    when: '출산 전 (퇴원하는 날부터 필요해요)',
    window: { anchor: 'lmp', start: 210 },
    milestoneKey: bagKey('car-seat'),
    detail:
      '도로교통법 제50조에 따라 6세 미만 아이는 카시트에 태워야 하고, 어기면 운전자에게 과태료 6만 원이 부과돼요. 퇴원하는 차부터 적용되니 출산 전에 미리 장착해 둬요.',
    sources: [S.easylawCarSeat, S.childcareCarSeat],
  },
  {
    id: 'p3-work-hours',
    phase: 'pregnancy-3rd',
    who: 'carrier',
    kind: 'work',
    title: '임신기 근로시간 단축 (32주 이후)',
    when: '임신 218일째부터 출산 전까지 · 시작 3일 전까지 신청',
    // 218th day counting the LMP as day 1 = LMP + 217 (고용노동부 기준); usable until the birth.
    window: { anchor: 'lmp', start: 217 },
    detail:
      '2025-02-23 개정으로 시작 시점이 36주에서 32주로 앞당겨졌고, 하루 2시간을 임금 삭감 없이 줄일 수 있어요. 고용노동부는 ‘32주 이후’를 임신 후 218일부터로 계산해요. 회사마다 신청 방법이 다를 수 있어요.',
    sources: [S.moelPolicy2025, S.easylawWorkHours, S.babytimesWorkHours],
    link: LINK.moel,
  },
  {
    id: 'p3-maternity-leave',
    phase: 'pregnancy-3rd',
    who: 'carrier',
    kind: 'work',
    title: '출산전후휴가 90일 일정 정하기',
    when: '예정일 44일 전(다태아 59일 전) 이후에 시작',
    // Opens 44 days before the due date; no closing day before the birth.
    window: { anchor: 'edd', start: -44 },
    detail:
      '휴가는 90일(다태아 120일, 2025-02-23부터 미숙아 출산은 100일)이고, 출산 후 45일(다태아 60일)이 남도록 시작일을 잡아요. 유산·사산 경험이 있거나 만 40세 이상이거나 유산 위험 진단을 받았다면 출산 전 어느 때나 나눠 쓸 수 있어요. 급여 지원 범위는 회사 규모(우선지원대상기업 여부)에 따라 달라요.',
    sources: [S.easylawMaternity, S.gov24Maternity, S.easylawEarlyLeave],
    link: LINK.moel,
  },
  {
    id: 'p3-parental-leave',
    phase: 'pregnancy-3rd',
    who: 'both',
    kind: 'work',
    title: '육아휴직 계획 세우기',
    when: '출산 전에 계획 · 휴직 시작 30일 전까지 회사에 신청',
    // "30일 전까지" counts back from the leave's own start, not from the due date.
    window: { anchor: 'edd', start: -90 },
    detail:
      '2025-02-23부터 부모가 각각 3개월 이상 쓰면 1인당 육아휴직이 1년에서 1년 6개월로 늘어나요. 2025년 급여 상한은 1~3개월 월 250만 원, 4~6개월 월 200만 원, 7개월부터 월 160만 원이고, 매달 전액 받아요.',
    sources: [S.koreaParental, S.babytimesParental, S.easylawParental],
    link: LINK.moel,
  },
  {
    id: 'p3-postnatal-care',
    phase: 'pregnancy-3rd',
    who: 'carrier',
    kind: 'admin',
    title: '산모·신생아 건강관리(산후도우미) 신청',
    when: '예정일 40일 전부터 신청할 수 있어요 (출산 후 60일까지)',
    // Open until the birth; after it, birth-postnatal-care carries the 60-day deadline.
    window: { anchor: 'edd', start: -40 },
    milestoneKey: planKey('postnatal-care'),
    detail:
      '기준중위소득 150% 이하 출산 가정이 원칙이고, 보건소나 복지로에서 신청해요. 150% 초과 가정 예외지원을 ‘2026-09-30 신청분까지’로 안내한 지자체도 있어 관할 보건소에 확인해요. 서비스 기간은 5~40일이고, 바우처는 출산일부터 90일 안에 써요.',
    sources: [S.gov24Postnatal, S.gwanakPostnatal, S.gjcityPostnatal],
    link: LINK.bokjiro,
  },

  // ── 출산 직후 ─────────────────────────────────────────────
  {
    id: 'birth-partner-leave',
    phase: 'birth',
    who: 'partner',
    kind: 'work',
    title: '배우자 출산휴가 20일',
    when: '예정일 50일 전 ~ 출생 후 120일 안 (2026-09-18부터)',
    window: { anchor: 'edd', start: -50, end: 120 },
    detail:
      '20일 모두 유급이고 3번까지 나눠 쓸 수 있어요(2025-02-23부터). 2026-09-18부터는 예정일 50일 전부터 쓸 수 있고, 출산이 늦어져도 법정휴가로 인정돼요. 출생 후 120일이 지나면 쓸 수 없으니 둘이 일정을 미리 맞춰 봐요.',
    sources: [S.easylawSpouseLeave, S.insidepeopleSpouse, S.seoulShinmunSpouse],
    link: LINK.moel,
  },
  {
    id: 'birth-hepb',
    phase: 'birth',
    who: 'both',
    kind: 'vaccine',
    title: '신생아 B형간염 1차 접종',
    when: '출생 직후 (분만 병원)',
    window: { anchor: 'birth', start: 0, end: 6 },
    detail:
      'B형간염 접종은 출생 때, 생후 1개월, 6개월에 모두 3번 해요. 산모가 B형간염 양성이면 출생 후 12시간 안에 면역글로불린(HBIG)과 백신을 함께 맞히고, 비용이 지원돼요.',
    sources: [S.nipHepB, S.nipPerinatalHepB],
  },
  {
    id: 'birth-metabolic',
    phase: 'birth',
    who: 'both',
    kind: 'test',
    title: '선천성대사이상 선별검사',
    when: '생후 48시간 ~ 7일 (수유 후 약 2시간 뒤 채혈)',
    window: { anchor: 'birth', start: 2, end: 7 },
    detail:
      '기본 6종 검사와 텐덤매스 검사를 합쳐 약 50종을 한 번의 채혈로 확인해요. 분만 병원에 입원해 있는 동안 받으면 본인부담이 없고, 재검·확진검사는 7만 원 한도에서 지원돼요.',
    sources: [S.seoulMetabolic, S.snuhMetabolic],
  },
  {
    id: 'birth-hearing',
    phase: 'birth',
    who: 'both',
    kind: 'test',
    title: '신생아 청각선별검사',
    when: '생후 1개월 안 (재검이면 3개월 안에 확진검사)',
    window: { anchor: 'birth', start: 0, end: 30 },
    detail:
      '모든 신생아는 생후 1개월 안에 선별검사를 받고, 재검이 나오면 3개월 안에 확진검사를 받아요(1-3-6 원칙). 선별검사는 건강보험이 적용되고, 확진검사비는 7만 원 안팎까지 지원돼요(지역마다 달라요).',
    sources: [S.hearing, S.easylawHearing],
  },
  {
    id: 'birth-bcg',
    phase: 'birth',
    who: 'both',
    kind: 'vaccine',
    title: 'BCG(결핵) 접종 예약',
    when: '생후 4주 안',
    window: { anchor: 'birth', start: 0, end: 27 },
    detail:
      '피내용 BCG는 지정 의료기관과 보건소에서 무료로 맞아요. 접종 기관과 일정이 한정돼 있어 퇴원 전에 예방접종도우미에서 기관을 찾아 예약해 두면 좋아요.',
    sources: [S.nipBcg],
  },
  {
    id: 'birth-registration',
    phase: 'birth',
    who: 'both',
    kind: 'admin',
    title: '출생신고',
    when: '태어난 날부터 1개월 안',
    // "1개월", counted from the birth day itself (가족관계등록법 제37조: 신고기간은
    // 신고사건 발생일부터 기산), ends 27–30 days later: Feb 1 → Feb 28 in a common
    // year is the shortest. The template keeps that shortest reading; the 챙길 것
    // view computes the exact day (MONTH_DEADLINES), never later than the law.
    window: { anchor: 'birth', start: 0, end: 27 },
    deadline: true,
    detail:
      '가족관계등록법상 출생 후 1개월 안에 신고해야 하고, 정당한 사유 없이 늦으면 5만 원 이하 과태료가 부과될 수 있어요. 2024-07-19부터 병원이 출생을 알리는 출생통보제가 시행됐지만 부모의 신고는 따로 해야 해요.',
    sources: [S.easylawBirthReport, S.hiraBirthNotice],
  },
  {
    id: 'birth-happy-birth',
    phase: 'birth',
    who: 'both',
    kind: 'admin',
    title: '행복출산 신청 (부모급여·아동수당)',
    when: '출생일 포함 60일 안',
    window: { anchor: 'birth', start: 0, end: 59 },
    deadline: true,
    milestoneKey: CLAIM_KEY,
    detail:
      '출생신고 때 정부24나 주민센터에서 첫만남이용권·부모급여·아동수당·양육수당 등을 한 번에 신청해요. 부모급여(0세 월 100만 원, 1세 월 50만 원)와 아동수당(2026년부터 만 9세 미만, 수도권 월 10만 원)은 출생일 포함 60일 안에 신청해야 출생월부터 받고, 늦으면 신청한 달부터 받아요. 첫만남이용권은 출생일로부터 2년 안에 신청하고 써야 해요(2024년 이후 출생아).',
    sources: [S.gov24HappyBirth, S.koreaHappyBirth, S.koreaParentAllowance, S.mohwChildAllowance],
  },
  {
    id: 'birth-insurance',
    phase: 'birth',
    who: 'both',
    kind: 'admin',
    title: '아기 건강보험 피부양자 등록 확인',
    when: '출생신고 직후 (늦어도 90일 안)',
    window: { anchor: 'birth', start: 0, end: 89 },
    detail:
      '자동 연계 대상이면 출생신고 뒤 따로 신고하지 않아도 피부양자로 올라가지만, 연계가 안 되면 직접 신고해야 해요. 90일 안에 신고해야 출생일로 소급된다고 안내되니, 국민건강보험공단 앱이나 홈페이지에서 등록됐는지 확인해요.',
    sources: [S.nhisDependent, S.gov24Dependent],
    link: LINK.nhis,
  },
  {
    id: 'birth-postnatal-care',
    phase: 'birth',
    who: 'carrier',
    kind: 'admin',
    title: '산후도우미 바우처 신청 마감',
    when: '출산일부터 60일 안 (아기가 입원했다면 퇴원 후 30일 안)',
    window: { anchor: 'birth', start: 0, end: 59 },
    deadline: true,
    milestoneKey: planKey('postnatal-care'),
    detail:
      '출산 전에 신청하지 못했다면 출산 후 60일 안에 보건소나 복지로에서 신청할 수 있어요. 바우처는 출산일(또는 퇴원일)부터 90일 안에 써야 해요. 소득 기준과 예외지원은 보건소마다 안내가 달라요.',
    sources: [S.gov24Postnatal, S.gwanakPostnatal],
    link: LINK.bokjiro,
  },

  // ── 출산 후 ───────────────────────────────────────────────
  {
    id: 'pp-infant-checkup-1',
    phase: 'postpartum',
    who: 'both',
    kind: 'hospital',
    title: '영유아 건강검진 1차',
    when: '생후 14~35일',
    window: { anchor: 'birth', start: 14, end: 35 },
    milestoneKey: checkupKey('1'),
    detail:
      '2021-01-01부터 생후 14~35일 첫 검진이 생겨 영유아 건강검진은 모두 8차예요. 본인부담 없이 받을 수 있고, 검진기관은 국민건강보험공단에서 찾을 수 있어요.',
    sources: [S.mohwInfantCheckup, S.doctorsnewsCheckup],
  },
  {
    id: 'pp-mother-checkup',
    phase: 'postpartum',
    who: 'both',
    kind: 'hospital',
    title: '산모 산후검진 · 마음 살피기',
    when: '분만 후 4~6주 (늦어도 12주 안)',
    window: { anchor: 'birth', start: 28, end: 42 },
    detail:
      '국내에서는 보통 분만 후 4~6주에 산후검진을 받아요. ACOG는 3주 안에 첫 연락, 12주 안에 종합 산후검진을 권해요. 우울감이나 불안이 2주 넘게 이어지면 전문가와 상담하도록 둘이 함께 살펴요.',
    sources: [S.acogPostpartum, S.easylawPostpartum],
  },
  {
    id: 'pp-vaccine-alerts',
    phase: 'postpartum',
    who: 'both',
    kind: 'admin',
    title: '예방접종 일정 확인 · 알림 신청',
    when: '출생신고 뒤',
    detail:
      '예방접종도우미에서 아기 접종 일정과 내역을 볼 수 있고, 국민비서(카카오톡·네이버 등)에서 ‘필수예방접종 알림’을 신청하면 다음 접종 시기를 알려 줘요. 비슷한 이름의 비공식 앱도 있으니 공식 사이트에서 확인하세요.',
    sources: [S.nip, S.nipAlerts],
  },
  {
    id: 'pp-regional-postpartum',
    phase: 'postpartum',
    who: 'carrier',
    kind: 'admin',
    title: '지자체 산후조리비 지원 (예: 서울)',
    when: '서울 기준 출산 후 180일 안에 신청',
    detail:
      '서울은 2026-01-01 이후 출생아부터 첫째 100만 원, 둘째 120만 원, 셋째 이상 150만 원을 지원하고, 신청 기간을 60일에서 180일로 늘렸어요(2026-03-30 개정). 산모 본인이 몽땅정보통에서 신청해야 해요(대리 신청 불가). 금액과 조건은 지자체마다 달라요.',
    sources: [S.seoulPostpartumCost, S.mtSeoul2026],
    link: LINK.seoulAgi,
  },
  {
    id: 'pp-six-plus-six',
    phase: 'postpartum',
    who: 'both',
    kind: 'work',
    title: '6+6 부모육아휴직제',
    when: '아이 생후 18개월 안에 둘 다 육아휴직을 쓸 때',
    detail:
      '부모가 모두 쓰면 처음 6개월은 각자 통상임금의 100%를 받아요. 2025년 기준 월 상한은 1·2개월 250만 원, 3개월 300만 원, 4개월 350만 원, 5개월 400만 원, 6개월 450만 원이에요. 둘의 휴직 시작 시점을 함께 짜 보세요.',
    sources: [S.moelSixSix, S.koreaSixSix],
    link: LINK.moel,
  },
  {
    id: 'pp-high-risk',
    phase: 'postpartum',
    who: 'carrier',
    kind: 'admin',
    title: '고위험 임산부 의료비 지원 (해당될 때)',
    when: '분만일부터 6개월 안에 신청',
    detail:
      '조기진통, 중증 임신중독증, 전치태반, 다태임신 등 19대 고위험 임신질환으로 입원 치료를 받았다면 소득과 상관없이 신청할 수 있어요. 전액본인부담금과 비급여 진료비의 90%를 1인당 300만 원 한도로 돌려받고, 주소지 보건소에 신청해요.',
    sources: [S.easylawHighRisk, S.seoulHighRisk],
  },
  {
    id: 'pp-passport',
    phase: 'postpartum',
    who: 'both',
    kind: 'admin',
    title: '아기 여권 (필요할 때)',
    when: '출생신고 뒤, 해외여행 계획이 있을 때',
    detail:
      '법정 기한은 없어요. 만 18세 미만은 유효기간 5년 여권이 나오고 부모가 신청해요. 사진은 신청 전 6개월 안에 찍은 것이어야 하고, 발급에 보통 몇 주 걸려요.',
    sources: [S.passport, S.ibabyPassport],
    link: LINK.passport,
  },
]

/** Official program link wins over a generic one when the item maps to a program card. */
export const ROADMAP: RoadmapTemplate[] = TEMPLATES.map((t) => {
  const link = programLink(t.id) ?? t.link
  return link ? { ...t, link } : t
})

export function templateById(id: string): RoadmapTemplate | undefined {
  return ROADMAP.find((t) => t.id === id)
}
