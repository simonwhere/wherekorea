# Skill 07 — Image Curation

> 이미지 작업 시 읽는다. 같이: `03`(카드, 있으면), `11-design-qa.md`.

## 원칙
이미지는 장식이 아니라 **product data**다. destination을 못 알아보게 하면 신뢰도가 떨어진다.

요건: destination-specific · recognizable · Korean context가 보임 · landmark/landscape/local identity · card crop(3:4)과 detail/preview crop(16:10) 모두에서 작동 · 너무 generic하지 않음.

## 현재 구현 메모
- `Destination`엔 단일 `image: { src, alt, credit? }`만 있음 (`data/types.ts`). `photos[]` 없음.
- 단, `DestinationPreviewPanel.tsx`는 "1/3" 배지 + 점 3개로 **다중 사진을 가장**한다 (실제론 1장). → 정리 필요(skill 11 / G2).
  - MVP: 가짜 점/배지 제거하고 단일 이미지.
  - 풀구현: `types.ts`에 `photos: DestinationImage[]` 추가 + `destinations.ts` 10개 동기화 후 실제 캐러셀.

## audit 먼저, 교체는 나중
이미지 작업 요청 시 바로 교체하지 말고, 먼저 destination별로 "이 이미지가 그 장소를 분명히 보여주는가"를 점검해 generic/부정확한 것만 flag.

## destination별 추천 검색 키워드
- Seoul: Seoul skyline Han River / Gyeongbokgung / Bukchon Hanok Village / Seoul night city
- Busan: Gamcheon Culture Village / Haeundae skyline / Gwangan Bridge / Jagalchi Market
- Jeju: Seongsan Ilchulbong / Jeju oreum / stone wall coast / Hallasan
- Gyeongju: Daereungwon / Woljeonggyo / Cheomseongdae / historic area
- Jeonju: Hanok Village / bibimbap / old town / traditional street
- Gangneung: Anmok Coffee Street / beach pine forest / Gyeongpo beach / East Sea
- Sokcho: Seoraksan Ulsanbawi / Sokcho harbor / seafood market / Seoraksan autumn
- Tongyeong: harbor / cable car / islands / Dongpirang village
- Namhae: German Village / terraced rice fields / sea road / Boriam temple
- Jirisan: Jirisan Korea / Nogodan / trail / valley Korea

## alt 텍스트
구체적으로. 예: "Seoul cityscape with Namsan Tower at night" (현재 seoul seed가 좋은 예).
