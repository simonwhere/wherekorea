# 조사 원자료 (2026-09-26~27)

앱의 의학·정부 지원·법·경쟁 앱 관련 문구는 이 파일들을 근거로 썼어요. 콘텐츠를 고치거나 더할 때도 여기서 근거를 찾고, 없으면 새로 조사해서 파일을 추가해요.

| 파일 | 내용 |
|---|---|
| `medical.json` | 가임기 정의·예측 정확도·LH 테스트·관계 빈도·영양제·남성 요인 (Wilcox, ASRM, NICE, Cochrane, FAZST …) |
| `medical-checklist.json` | 임신 전 → 출산 직후 병원·검사·접종 35개 항목 (사실 확인 수정 사항은 `notes`에) |
| `admin-timeline.json` | 조리원·휴가·바우처·출생신고 등 행정 일정 28개 항목 (2026-09-18 배우자 지원 3종 포함) |
| `kr-programs.json` | 정부 지원사업 (가임력 검사, 엽산제, 난임 시술비, 국민행복카드, 첫만남이용권, 부모급여 …). 2026-10-02 추가(Next B 난임 시술 카운터, `lib/logic/treatments.ts`): `ivf-count-merged-2024-02`(인공수정 5·체외수정 20 신선/동결 통합·출산당 25 — `inUI`가 꺼지면 카운터의 분모가 화면에서 사라져요, SUPPORT_TOTALS_VERIFIED), `notice-valid-6-months-2026`(지원결정통지서 유효기간 6개월, 2026-01 전 3개월), `infertility-leave-paid-4-days-2026-11-27`(난임치료휴가 유급 2일 → 4일). 회당 상한·사실혼은 링크만 |
| `kr-apps.json`, `global-apps.json` | 경쟁 앱 조사 |
| `regulation.json` | 개인정보(민감정보)·의료기기 경계·스토어 정책·알림 문구 |
| `dates-data.json` | 데이트 추천 데이터 소스(TourAPI·카카오·네이버)와 관련 근거 |
| `couple-record.json` | 비트윈·썸원 등 커플 기록장 교훈 |
| `lh-tests.json` | 배란테스트기 사용법 근거(시작일 표·시간대·첫 소변·수분·판독·하루 두 번·구매처·가격) — '+ 기록' LH 패널의 '어떻게 해요?' 시트 문장은 `inUI: true` 항목에서만 나와요. 검색 요약 기반·원문 미열람(프록시 차단), 확인일 2026-10-02 |
| `early-pregnancy-bleeding.json` | 양성 뒤 출혈 안내 근거 (ACOG·NHS: 초기 출혈 빈도, 병원 연락, 응급 신호, 꼭 끝나는 건 아님, 발열) — 홈의 '출혈이 시작됐어요' 카드 문장은 `inUI: true` 항목의 `ui`에서만 나와요(`lib/logic/positiveBleeding.ts` BLEEDING_LINES, 테스트로 고정). 검색 요약 기반·원문 미열람(프록시 차단), 확인일 2026-10-02 |
| `after-loss.json` | 임신이 끝난 뒤 안내 근거 (ACOG·WHO 2005 vs Kangatharan 2017·Schliep 2016·Tommy's: 첫 생리 4~6주, 2주 뒤 배란 가능, 의학적 대기 불필요, 마음 준비, 병원 연락 신호, 반복 유산 검사, 유산·사산휴가) — 홈의 after-loss 카드 한 줄은 `inUI: true` 항목의 `ui`에서만 나와요(`lib/logic/ttcFlow.ts` AFTER_LOSS_LINES; 'ovulation-2-weeks'는 일부러 안 써요). `kr-leave`는 요약끼리 어긋나 `inUI: false`. 검색 요약 기반·원문 미열람, 확인일 2026-10-02 |

## 남편 체크 포인트 12개 (2026-11-01)

창업자 결정('12개 전부 넣어줘')으로 넣은 남편 체크 포인트와 '이번 주 민수님' 요약의 근거예요. 새 파일 없이 기존 파일에 `id`가 붙은 항목으로 더했어요(`id · checked · verified · inUI · notes`). 모두 **검색 요약**이라 `verified: false`예요 — go.kr·moel·nice·asrm 원문은 세션 네트워크에서 열리지 않았어요. 화면은 숫자(%·배수·지역 이름)를 쓰지 않고 "…마다 달라요"를 붙여요. 날짜 계산은 `lib/logic/partnerDates.ts` 한 곳이에요.

| 파일 | id | 쓰는 곳 |
|---|---|---|
| `kr-programs.json` | `fertility-check-intake-2026` | 신청 단계 '접수 중인지 먼저 확인' 줄, [접수가 끝났대요] 뒤 1월 알림 |
| `kr-programs.json` | `fertility-check-morphology-claim` | 정액검사 예약 단계 '검사의뢰서에 적힌 검사(정자정밀형태검사)로 받는지' 줄 |
| `kr-programs.json` | `infertility-leave-paid-4-days-2026-11-27` (보강) | 병원과 함께 모드 '유급 4일' 알림 한 번 — '연 6일 중 처음 4일', 고용노동부 news_seq=19813 |
| `medical-checklist.json` | `partner-flu-season-2026-27` | 챙길 것 계절 항목 `partner-flu`(준비 10~12월, 임신 중 10~4월, 절기마다 완료 새로) |
| `medical-checklist.json` | `partner-tdap-once` | Tdap 알림 예정일 −60·−21, '맞은 적이 없다면 … 1번' |
| `medical.json` | `male-semen-test-abstinence` | 검사 7일 전(가까우면 예약할 때) 준비 확인 알림 |
| `medical.json` | `male-medicines-testosterone` | '먹는 약이나 근육 키우는 약·주사가 있으면 검사받을 때 의사에게 말해요' (그의 화면만) |
| `medical.json` | `male-e-cigarettes` | 첫 실행 담배 질문 '(전자담배 포함)' — 행 이름은 그대로 |
| `medical.json` | `secondhand-smoke-home-car`, `quit-smoking-clinic-kr` | 흡연자 금연 체크인 줄, 보건소 금연클리닉 링크(금연길라잡이) |
| `medical.json` | `heat-check-retire-pregnancy` | 임신 확인 뒤 사우나·노트북 체크 내려놓기 카드 |
| `medical.json` | `paternal-perinatal-depression`, `mental-health-lines-kr` | 출생 뒤 90일 '요즘 나는 어때요?' 한 번, 1577-0199 · 109 · 119 · 난임·임산부심리상담센터 |
| `admin-timeline.json` | `spouse-birth-leave-120-days` | 배우자 출산휴가 끝 = 실제 출생일 + 119(이른 쪽), 출생 전 '출생 후 120일 안', 고용센터(1350) |
| `admin-timeline.json` | `postnatal-care-spouse-apply` | 산후도우미 신청 예정일 −40 알림(둘 다), '신청은 내가 맡기' |

## 앱 콘텐츠와의 연결 (2026-10-02)

화면에 나오는 콘텐츠는 `lib/content/data/*.json`(roadmap · programs · supplements · dateIdeas · fertility · pregnancy · baby)에 있고, `lib/content/*.ts`는 그 JSON을 읽는 로더예요. 항목마다 네 가지를 붙여요.

| 필드 | 뜻 |
|---|---|
| `effectiveFrom` | 그 규칙·안내가 시행된 날(`YYYY-MM-DD`). 시행일이 없는 일반 안내는 글을 쓴 날 |
| `checkedAt` | 숫자·링크를 출처와 마지막으로 맞춰 본 날 |
| `sources` | 출처(파일 안 `sources` 표의 키, 또는 `{ name, url }`). 사실을 말하는 항목(로드맵·지원 제도·영양제·가이드)은 1개 이상 |
| `verified` | `true` = 이 폴더의 조사 항목 중 `confidence: "high"`와 맞고 열린 질문이 없음. `false` = **미확인**: 조사 항목이 medium/low이거나, 원문을 못 열었거나(프록시 차단), N18처럼 사람이 확인할 일이 남음. 이때는 `checkNote`에 무엇을 확인해야 하는지 적어요 |

- `npm test`가 먼저 `scripts/validate-content.mjs`를 돌려요(날짜 형식, URL, 출처 키, 금지어, `verified:false`의 `checkNote`, id 중복). `npm run validate:content`는 파일별 미확인 개수도 보여 줘요.
- 로더는 `*_AUDIT` 맵(`ROADMAP_AUDIT`, `PROGRAM_AUDIT` …)으로 이 필드를 따로 내보내요. 화면에 '미확인' 표시를 붙일 때 그걸 읽으면 돼요. 화면이 받는 모양(`RoadmapTemplate`, `Program` …)은 그대로예요.
- 콘텐츠를 고칠 때는 JSON만 고치고, 근거는 이 폴더에 먼저 더해요. `verified`를 `true`로 바꾸는 건 공식 원문을 직접 본 사람만 해요.

**주의:** 조사할 때 웹페이지 원문을 직접 열 수 없어서, 대부분 **검색 결과 요약**을 근거로 했어요. 각 파일의 `confidence`와 `notes`(수정 사항)를 확인하고, **출시 전에는 공식 원문으로 다시 확인**해야 해요. 특히 금액, 대상, 기한은 해마다 바뀌어요.
