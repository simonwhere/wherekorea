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

**주의:** 조사할 때 웹페이지 원문을 직접 열 수 없어서, 대부분 **검색 결과 요약**을 근거로 했어요. 각 파일의 `confidence`와 `notes`(수정 사항)를 확인하고, **출시 전에는 공식 원문으로 다시 확인**해야 해요. 특히 금액, 대상, 기한은 해마다 바뀌어요.
