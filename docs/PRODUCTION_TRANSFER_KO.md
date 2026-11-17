# 운영 서버 이전 절차 (Windows x64 / Conda 기준)

## 1. 개발 서버 준비

1. 운영 업데이트와 질문 분류를 완료하거나 일시 중단하고, 대시보드 서버를 종료합니다. 복사 중 DB를 쓰는 프로세스가 없어야 합니다.
2. 프로젝트 전체를 별도로 백업합니다. `.env`, CSV, DB는 사내에서만 이동하며 공개 저장소에 올리지 않습니다.
3. 이번 배포본의 `backend_v2`, `frontend_v2/dist`를 사용합니다. 운영 서버에는 Node.js나 npm 설치가 필요 없습니다.
4. 프로젝트 루트의 실제 `.env`와 `data` 폴더를 함께 복사합니다. `.env.example`은 설명용이며 실제 `.env`를 덮어쓰지 않습니다.
5. 설정에 절대 경로로 지정한 CSV·DB가 data 밖에 있으면 별도로 복사하고 운영 서버 경로로 수정합니다.
6. 분석 DB, 토큰 DB, 분류 DB, 운영 이력 DB 네 종류를 모두 옮깁니다. 이름은 실제 `.env` 설정을 기준으로 합니다. SQLite의 `-wal`, `-shm` 파일이 남아 있으면 DB 본체와 함께 복사합니다. 실행 중인 DB 본체만 복사하지 않습니다.

기본 파일 구조:

```text
D:\project\oui-dashboard-v2\
  .env
  backend_v2\
  frontend_v2\dist\index.html
  frontend_v2\dist\assets\
  data\
```

## 2. Python 실행 환경 반입

운영 서버에 동일 앱 환경이 이미 있으면 재설치하지 않아도 됩니다. 환경이 없는 새 서버는 개발 서버와 같은 Windows x64 기준으로 기존 Conda 환경을 압축합니다. Linux 서버에는 Windows 환경 ZIP을 사용하지 않습니다.

개발 서버의 Miniconda Prompt에서 프로젝트 루트로 이동 후:

```bat
conda activate oui-dashboard-v2
powershell -NoProfile -File backend_v2\scripts\Pack-CurrentCondaEnvironment.ps1 -OutputDirectory conda-bundle-production
```

conda-pack 미설치 오류라면 패키지가 준비된 환경에서 requirements-pack.txt를 설치한 뒤 다시 실행합니다. 폐쇄망에서는 온라인 설치 명령만으로 해결되지 않습니다. 생성된 `conda-bundle-production` 전체와 기존 승인된 Miniconda 설치 파일을 반입합니다.

운영 서버에 Miniconda 설치 후 PowerShell에서 반입 폴더의 상위 위치 기준으로:

```powershell
.\conda-bundle-production\backend_v2\scripts\Install-CondaBundle.ps1 -BundleDirectory .\conda-bundle-production -EnvironmentPrefix "$env:USERPROFILE\miniconda3\envs\oui-dashboard-v2"
```

기존 환경 경로를 덮어쓰지 않습니다. 필요하면 oui-dashboard-v2-r2 같은 새 경로에 설치합니다. 압축 해제만 하지 말고 설치 스크립트의 경로 보정까지 완료합니다.

## 3. 운영 설정 확인

기존 `.env` 값을 유지하되 다음 항목을 운영 서버에서 확인합니다.

- OPENWEBUI_URL: 운영 서버에서 접근 가능한 OpenWebUI 주소. 다른 서버라면 127.0.0.1을 쓰지 않습니다.
- LITELLM_BASE_URL / CATEGORY_LITELLM_BASE_URL: 운영 서버에서 접근 가능한 LiteLLM 주소.
- 각 API 키와 CATEGORY_LLM_MODEL: 현행 운영값 유지.
- DASHBOARD_FRONTEND_DIR=frontend_v2/dist
- CSV와 DB 경로: 운영 서버 위치와 일치하는지 확인. 상대 경로는 프로젝트 루트 .env 기준.
- DASHBOARD_API_TOKEN: 설정한 경우 별도 접속 암호 화면에서 입력합니다.
- 같은 서버의 FastAPI가 화면까지 제공하면 DASHBOARD_CORS_ORIGINS는 비워 둡니다.

## 4. 서버 실행

운영 서버의 Miniconda Prompt에서:

```bat
conda activate oui-dashboard-v2
cd /d D:\project\oui-dashboard-v2
python -m pip check
python -m uvicorn backend_v2.app:create_app --factory --host 0.0.0.0 --port 8011 --workers 1
```

운영에서는 --reload를 사용하지 않습니다. 백그라운드 작업 관리가 있으므로 우선 단일 worker로 운영합니다. 0.0.0.0은 수신 주소이고 브라우저 접속 주소가 아닙니다.

로컬 확인: http://localhost:8011
다른 PC: http://운영서버주소:8011

다른 PC 접속을 위해 사내 정책에 따라 TCP 8011 접근을 허용합니다. 기존 HTTPS 프록시가 있으면 그 주소를 사용하고 프록시는 같은 백엔드로 /api 경로도 전달해야 합니다.

## 5. 배포 확인

1. `/api/dashboard/v2/auth/status`가 404 없이 required/authenticated JSON을 반환하는지 확인합니다.
2. 암호를 설정했다면 로그인합니다. Ctrl+F5로 최신 화면을 불러옵니다.
3. 사용자 수, 전체 질문 수, 토큰 합계, 분류 건수와 운영 마지막 성공 시각을 이전 서버와 비교합니다.
4. 메뉴 아이콘 비율, 영문 부제 줄바꿈, 데스크톱 메뉴 접기/펼치기, 좁은 창에서 열기/닫기를 확인합니다.
5. 운영 업데이트의 일반 `업데이트`를 실행해 연결과 변경분 수집을 확인합니다. DB 이력을 가져왔다면 이전만을 위해 전체 재수집/전체 재분류를 할 필요가 없습니다.
6. 재시작 후에도 DB와 실행 이력이 유지되는지 확인합니다.

## 6. 상시 실행과 복구

수동 확인이 끝나면 사내 표준 서비스 관리자나 작업 스케줄러에 같은 실행 명령을 등록합니다. 실행 계정의 Python 환경, 작업 폴더, DB/CSV 쓰기 권한을 맞추고 재부팅 후 접속을 확인합니다. stdout/stderr는 사내 로그 경로에 보관합니다. 중복 서버 프로세스를 만들지 않습니다.

문제가 생기면 새 서버를 종료하고 백업한 코드·설정·DB 묶음으로 복구합니다. 개발 서버와 운영 서버가 동시에 같은 DB 파일을 공유하거나 동기화를 실행하도록 두지 않습니다.
