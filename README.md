# OUI Dashboard v2

2026-11-23 표시 간소화: 개요 상단은 선택 기간/사용량·토큰 데이터 기준과 빨간 윤곽 경고 아이콘의 '업데이트 필요'만 표시합니다. 상세 미반영 안내는 제거했으며 화면 시각은 한국 시간 분 단위까지 표시합니다.

2026-11-23: 월요일08:30 자동 업데이트, 원천별 데이터 기준/미반영 안내, 기간 기억/이번 달 기본값을 반영했습니다. 설정과 반영 절차는 `docs/AUTO_UPDATE_AND_PERIOD_20261123_KO.md`를 확인하세요.

이후 개발 기준 저장소: https://github.com/Nagyeong3/openwebui-dashboard-v2

2026-11-16 최신 배포 ZIP을 복원한 뒤 2026-11-17 후속 보고 지표를 반영한 저장소입니다.
기준 ZIP SHA256: `55bbdf2fb586e9a6928ccedf8e7a424d61b3d436dfa230dbd5367280ad4ed21c`.
원본 파일별 체크섬은 `BUILD-MANIFEST.json`에 있습니다.

## 실행

`.env.example`을 참고해 프로젝트 루트에 실제 `.env`를 설정합니다. 실제 설정, API 키, 사용자 CSV 및 운영 DB는 커밋하지 않습니다.

```sh
python -m pip install -r backend_v2/requirements.txt
python -m uvicorn backend_v2.app:create_app --factory --host 0.0.0.0 --port 8011 --workers 1
```

프런트 빌드:

```sh
cd frontend_v2
npm ci
npm run test
npm run build:api
```

백엔드 검증:

```sh
python -m unittest discover -s backend_v2/tests -q
```

운영 반영은 `docs/PRODUCTION_TRANSFER_KO.md`, 현재 기능과 지표 정의는 `docs/REPORTING_UPDATE_20261116_KO.md` 및 `backend_v2/README.md`를 확인합니다. `frontend_v2/dist`는 ZIP에 포함된 운영 빌드입니다.

## 2026-11-17 반영

- 주간 모델 응답 추이를 선그래프로 표시. 기간 총계와 최고 주간 수 유지.
- 팀장 순위는 이전 공동순위 대비 ▲/▼ 숫자 및 변동 없음 0 표시. 이전 사용량 0도 비교하며, 이력 부족은 — 표시.
- 개요 10개 지표에 직전 동일기간 증감률 또는 비교 불가와 사유 표시. 과거 사용자 명부가 없는 전체 사용자 수는 비교 불가.
- 최근 30일간 접속자와 일일 사용자 평균은 이전 30일 대비. 집계는 실제 로그인 로그가 아닌 질문 활동 기준.
- 상세 정의와 운영 적용: `docs/REPORTING_UPDATE_20261117_KO.md`.

실제 폐쇄망 원천 연결 및 브라우저 시각 검수는 별도 확인이 필요합니다.
