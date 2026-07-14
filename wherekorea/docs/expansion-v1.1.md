# 확장 v1.1 — 추가 5개 도시 (선정 확정 2026-07-11)

> ✅ **구현 완료 (같은 날):** 5개 풀 시드 입력 + meta(이름/지역/예산/지도좌표/near-seoul) + weather 좌표 + 이미지 실물 검증. tsc clean.
> 카드명은 "Damyang & Boseong" 한 카드로 구현. 남은 것: 로컬 build + dev 눈 확인, budget-calibration 근거 행 보강.

> `planning-trust-and-expansion.md` Part 2의 결정본. 신뢰 계약(A 예산정의 · B 혼잡모델 · C 메타)은
> 모두 코드에 반영돼 있으므로 같은 계약으로 확장한다. 15개 = 10 + 아래 5.

## 확정 5개

| 카드명 | 포지션 | 기존 10개와의 차별 |
|---|---|---|
| **Yeosu** | 남해안 밤바다 도시 | 밤 경관 + 케이블카 — 기존에 없는 vibe |
| **Andong** | 유교/전통 마을 | 하회마을·탈춤 — Gyeongju(왕릉)·Jeonju(음식)와 다른 결 |
| **Suwon** | 서울 당일치기 성곽 도시 | 화성 UNESCO, no-car 최상 — 첫 여행자 수요 |
| **Chuncheon** | 서울 근교 호수/자연 | 남이섬·닭갈비 — detail에 Nami 포함 (naming rule) |
| **Damyang·Boseong** | 대나무숲 + 녹차밭 | 시각 아이덴티티 강한 남부 자연 — 유일한 "정원형" 자연 |

- 5번째는 자연 포지션으로 Damyang·Boseong 선택(사용자 결정).
- ⚠️ **naming 열린 점**: 두 군이 ~1h 거리. 카드명 후보: "Damyang & Boseong"(한 카드) vs "Boseong"(앵커) + detail에 Damyang.
  현재 추천: **한 카드 "Damyang & Boseong"** — 여행자는 광주 베이스로 묶어 다니는 패턴. 구현 전 확정 필요.
- 참고: 겨울 갭(12–2월에 best인 도시 없음)은 여전히 남음 → 다음 확장에서 Pyeongchang 1순위 후보.

## 시드값 제안 (구현 시 검증·보정)

| slug | base_appeal | best_months | crowd_peak | stay | no-car | tags | ₩/day(안) |
|---|---|---|---|---|---|---|---|
| yeosu | 6 | [4,5,6,7,8,9,10] | [7,8] | 1–2 days | Okay | coastal, city, couple | ₩115k |
| andong | 5 | [4,5,9,10] | [10] | 1–2 days | Okay | history / traditional, solo | ₩100k |
| suwon | 5 | [4,5,6,9,10,11] | [4,10] | 1–2 days | Easy | history / traditional, city | ₩110k |
| chuncheon | 4 | [4,5,6,9,10] | [5,10] | 1–2 days | Easy | nature, couple | ₩105k |
| damyang-boseong | 4 | [4,5,6,7] | [5] | 1–2 days | Hard | nature, couple | ₩100k |

- 예산은 card_daily_total 정의(1인, 2인 1실, 숙박+식사+현지교통+활동) 기준 추정 — `budget-calibration.md`에 근거 행 추가 필요.
- trust 메타: budget `estimate`, crowd `seed`, confidence 신규 도시는 `low`로 시작.

## 구현 체크리스트 (VS Code handoff용)

1. `data/destinations.ts` — 5개 풀 엔트리 (모든 required 필드, editorial 톤은 editorial-guidelines 준수: best for / skip if / 과장 금지)
2. `data/destinations-meta.ts` — KOREAN_NAMES · REGIONS · DAILY_AVG · MAP_POS(지도 % 좌표) · 카테고리 멤버십
3. 이미지 5장 — skill 07 기준 destination-specific 큐레이션 (기존 4장 교체분과 같이 작업: `image-audit.md`)
4. `budget-calibration.md` — 5개 행 추가
5. `best-now-ranking.md` — 시드값 표에 5개 추가 (공식·가중치는 변경 없음)
6. 검증: tsc(필드 누락 자동 감지) + build + Best now 정렬에 신규 도시 자연스럽게 섞이는지

→ 연결: [[planning-trust-and-expansion]] · [[best-now-ranking]] · [[image-audit]] · [[data-policy]]
