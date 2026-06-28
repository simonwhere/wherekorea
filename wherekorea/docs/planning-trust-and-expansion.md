# 기획 — 지표 신뢰 + 목적지 확장

> 결정: 경쟁력은 **지표 신뢰**부터, 상세화는 **목적지 확장** 방향.
> 순서: ① 신뢰 데이터 계약 확정 → ② 기존 10개 재정합 → ③ 같은 계약으로 확장.
> (신뢰 없이 확장하면 역효과 — 믿을 수 있는 10개 > 흐릿한 30개)

---

## Part 1. 신뢰 데이터 계약 (먼저 못박을 것)

카드에 숫자를 크게 보여주는 순간, 그 숫자는 디자인이 아니라 **제품의 약속**이 된다.
모든 목적지가 채워야 할 "계약"을 정의한다. 3개 결정 필요:

### 결정 A — 예산 정의 (가장 시급) ⭐ 확인 필요
- 문제: 카드의 `₩155k/day`가 숙박 포함인지 제외인지 불명확. 사용자는 "하루 총비용"으로 읽음.
- 현재: `data-policy.md`는 card budget = **숙박 제외** mid daily spend로 정의. 하지만 UI는 원화 per-day를 보여줘서 오해 소지.
- **추천 재정의:** 카드 원화 = **"mid 여행자 하루 총비용(숙박+식사+현지교통+가벼운 활동 포함)".**
  - 이유: 사용자 직관과 일치, 비교가 의미 있어짐.
  - 영향: 현재 `DAILY_AVG` 값은 숙박 제외 기준이라 **상향 필요** (예: 서울 ₩155k → 숙박 포함 ~₩200k대). detail page에 "무엇을 포함하는지" 명시.
- → 당신 확인: 이 재정의로 갈까? (대안: 카드는 `$$` 같은 추상 레벨만, 원화는 detail에만)

### 결정 B — 혼잡도 모델
- 전국 실시간 혼잡 API는 어렵고 위험. **하이브리드**로 간다:
  `seasonal baseline + 주말/공휴일 + 이벤트 + (일부 live) + traveler feedback 보정`
- v1: seeded여도 되지만 **"이건 seasonal baseline"임을 내부적으로 명확히**. `crowd_notes`에 피크 타이밍 설명.
- (live 혼잡도는 한국관광공사 TourAPI로 나중에 — `planning-data-and-differentiation.md` 참조)

### 결정 C — 신뢰 메타데이터 (데이터 구조에만, UI 노출은 나중)
각 목적지/지표에 추가:
- `last_verified` (검수 날짜)
- `confidence` (high / medium / low)
- `source` (api / editorial / seed)
→ 처음엔 detail page 하단 compact 또는 내부용. 신뢰를 *구조적으로* 보장.

---

## Part 2. 목적지 확장 (계약 위에서)

### 원칙
- v1 non-goal = "전국 exhaustive coverage". 확장은 **큐레이션 유지**, exhaustive 아님.
- 다음 목표 ~15개 (10 + 5), 그 다음 단계적으로.
- 선정 기준: ①외국인이 "서울 다음 어디?"로 실제 고려 ②기존과 vibe 차별 ③데이터를 신뢰 있게 채울 수 있음.

### 현재 10개
Seoul · Busan · Jeju · Gyeongju · Jeonju · Gangneung · Sokcho · Tongyeong · Namhae · Jirisan

### 확장 후보 (그룹별)
- **서울 근처/쉬움:** Suwon(화성), Incheon, Gapyeong·Nami, Paju/DMZ, Chuncheon
- **문화/역사:** Andong(하회마을·탈춤)
- **해안/풍경:** Yeosu(밤바다·케이블카), Pohang(호미곶), Mokpo
- **도시:** Daegu, Daejeon, Gwangju
- **자연/섬:** Ulleungdo, Pyeongchang(겨울/올림픽), Damyang·Boseong(대나무·녹차)

### 추천 첫 5개 추가 (반응 부탁)
1. **Yeosu** — 남해안 밤바다, 기존에 없는 강한 vibe
2. **Andong** — 진짜 전통/유교 문화, Gyeongju와 다른 결
3. **Suwon** — 서울 당일치기, 화성 유네스코, no-car 쉬움
4. **Chuncheon(+남이섬)** — 서울 근교 자연, 첫 여행자 인기
5. **Pohang 또는 Paju/DMZ** — 호미곶 일출 vs 분단 체험(외국인 고유 수요)

---

## 다음 액션
1. **결정 A(예산 정의) 확정** ← 당신 확인 대기
2. 결정 B·C 데이터 구조 반영 (types.ts 확장)
3. 기존 10개를 새 계약으로 재검수 (1차)
4. 첫 5개 목적지 추가
5. (확장은 VS Code 작업 — seed 데이터 입력. 신뢰 계약 정의는 여기서)

→ 연결: [[PROJECT-BRIEF]] · [[STATUS-and-NEXT]] · [[planning-data-and-differentiation]]
