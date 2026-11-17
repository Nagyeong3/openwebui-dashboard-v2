# OUI Dashboard v2

이후 개발 기준 저장소: https://github.com/Nagyeong3/openwebui-dashboard-v2

2026-11-16 최신 배포 ZIP의 백엔드, 프런트 소스와 빌드 결과를 복원한 저장소입니다.
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

## 후속 요청 — 아직 미반영

- 주간 메시지 추이를 막대에서 선그래프로 변경.
- 팀장 순위의 신규 사용 문구를 이전 순위 대비 숫자 증감으로 변경.
- 개요의 요청된 10개 지표에 이전 동일기간 대비 증감률 추가. 과거 사용자 명부가 없는 지표 등 계산 불가능한 경우 비교 불가 표시.
- 최근 30일 사용 사용자 제목을 최근 30일간 접속자로 변경. 집계는 실제 로그인 로그가 아닌 질문 활동 기준임.

실제 폐쇄망 원천 연결 및 브라우저 시각 검수는 별도 확인이 필요합니다.
