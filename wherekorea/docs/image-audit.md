# 이미지 Audit — 2026-07-11 (실물 확인 완료)

> ✅ **해결됨 (같은 날):** flag 4장 전부 교체 완료 + 신규 5개 도시 이미지 추가. 전 9장 브라우저 실물 검증.
> - gangneung → 경포 송림+해변 / tongyeong → 언덕 위 항구·섬 전망 / namhae → 보리암 처마+바다 / jirisan → 지리산 계곡 항공(위치 태그 검증)
> - 신규: yeosu(케이블카+항구) · andong(하회 고택 대문) · suwon(화성 성곽) · chuncheon(남이섬 나무길) · damyang-boseong(녹차밭)
> - ⚠️ 남은 약점 1건: damyang-boseong 녹차밭이 보성 계단식으로 확정 못 함(Unsplash에 보성 0건) — generic 녹차밭. 추후 더 나은 소스로 교체 후보.

> skill 07 기준: destination-specific · recognizable · Korean context.
> 10장 전부 브라우저로 실제 렌더 확인함. 교체는 별도 작업 (audit 먼저, 교체는 나중).

## 결과 요약: 6 통과 / 4 flag

| slug | 실제 이미지 내용 | 판정 |
|---|---|---|
| seoul | 한강 + 남산타워 스카이라인 | ✅ 통과 — 정확, 인식 가능 |
| busan | 감천문화마을 | ✅ 통과 |
| jeju | 주상절리 (용암 절벽 + 바다) | ✅ 통과 — 제주 고유 지형 |
| gyeongju | 대릉원 고분 | ✅ 통과 |
| jeonju | 한옥마을 지붕 항공뷰 | ✅ 통과 |
| sokcho | 설악산 화강암 능선 | ✅ 통과 |
| gangneung | **바다 물결 클로즈업 (위치 정보 전혀 없음)** | 🔴 **High — 교체 필요.** 어느 나라 바다인지도 알 수 없는 generic 사진 |
| tongyeong | **컨테이너 항만 크레인 (산업 항구)** | 🔴 **High — 교체 필요.** alt는 "boats at sunset"인데 실제론 컨테이너 터미널. 통영의 어항/섬 정체성과 정반대 |
| namhae | **다랭이논이지만 베트남 사파로 보임** (파란 방수포, 베트남식 가옥) | 🟡 Medium — 교체 권장. 한국 아님일 가능성 높음 |
| jirisan | **바위+단풍 관목 (콜로라도풍, 한국 산세 아님)** | 🟡 Medium — 교체 권장. 지리산 능선 특징 없음 |

## 교체 검색 키워드 (skill 07 표 기준)

- gangneung: `Gyeongpo beach Korea` / `Anmok coffee street` / `Gangneung pine forest beach`
- tongyeong: `Tongyeong harbor fishing boats` / `Tongyeong cable car islands` / `Dongpirang village`
- namhae: `Namhae Daraengi terraced fields` / `Namhae German Village` / `Boriam temple sea view`
- jirisan: `Jirisan ridge Korea` / `Nogodan sea of clouds` / `Jirisan national park trail`

## 다음 최소 단계
Unsplash에서 위 키워드로 4장 교체 → `data/destinations.ts`의 `image.src`/`alt` 갱신 →
카드 3:4 crop과 preview 16:10 crop 양쪽에서 확인 (VS Code dev 서버).
alt 텍스트는 구체적으로 (예: "Gyeongpo Beach pine forest shoreline, Gangneung").
