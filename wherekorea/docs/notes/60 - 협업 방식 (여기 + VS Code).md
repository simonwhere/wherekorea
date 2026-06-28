---
tags: [wherekorea, workflow]
---

# 60 - 협업 방식 (여기 + VS Code)

## 분담
- **여기 (Cowork / Claude)** = 생각·구조·판단. 컨셉/기획, 코드 검토, 규칙·스펙 문서화, VS Code용 작업 지시문 작성.
- **VS Code (Claude Code)** = 실제 코딩. dev 서버로 화면 보며 구현, build/타입체크, 시각 디테일.

두 곳은 **같은 폴더**(`~/Documents/sbang_project/wherekorea`)를 봄. 한쪽에서 만든 문서가 다른 쪽에 그대로 있음.

## 중요한 사실
- 렌더된 UI를 직접 보는 건 **둘 다 못 함** → 결국 "당신"이 `npm run dev`로 봄.
- 차이는 실행 환경: VS Code는 build/dev를 **빠르게** 돌림. Cowork 샌드박스는 build가 느림/제한 있음.
- 그래서: **로직·구조는 여기서도 OK, build 검증·무거운 시각 반복은 VS Code.**

## 가능한 방식
1. 여기서 기획 → 지시문 → VS Code가 구현 (현재 계획)
2. 여기서 코드 작성 → 당신이 dev로 보기 → 피드백 → 수정 (한 곳 유지)
3. 하이브리드 (구조 여기, 시각 폴리싱 VS Code)

→ 넘기는 지시문 예시: [[handoff-G1-filter]]
