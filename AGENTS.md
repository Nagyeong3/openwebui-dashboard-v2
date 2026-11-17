# OUI-Dashboard-v2 작업 규칙

- 기준 저장소는 https://github.com/Nagyeong3/openwebui-dashboard-v2 입니다. 이전 openwebui-dashboard 저장소를 개발 대상으로 사용하지 않습니다.
- 먼저 README.md, backend_v2/README.md와 docs/REPORTING_UPDATE_20261116_KO.md를 읽습니다.
- backend_v2는 FastAPI 백엔드, frontend_v2는 React/Vite 프런트입니다. 최초 복원 파일의 체크섬은 BUILD-MANIFEST.json에 있습니다.
- 실제 .env, API 키, 내부 주소, 직원 정보, 운영 CSV/DB는 커밋하지 않습니다.
- 사용자 명부는 OpenWebUI API가 기준이며 CSV는 조직 정보 보강용입니다. CSV만 있는 사용자를 추가하지 않습니다.
- 전체 사용자/팀장 순위는 사용량 0인 사용자를 유지합니다. 동명이인 매핑은 추측하지 않습니다.
- 화면 문구는 한국어, 글자/차트 최소14px, 표 글자는17px 기준입니다. 글자를 줄이지 말고 배치를 조정합니다.
- 운영 주 동작명은 업데이트입니다. 실행 이력 내보내기나 상단 토큰 입력창을 추가하지 않습니다.
- 실제 원천/운영 검수와 합성 데이터 자동 테스트 결과를 구분합니다. 계산할 수 없는 비교 지표에 임의의 증감률을 넣지 않습니다.
- 변경 후 관련 자동 검증과 API 빌드를 수행합니다. 동봉 dist를 갱신하면 BUILD-MANIFEST.json도 갱신합니다.
