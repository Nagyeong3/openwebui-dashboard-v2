# 질문 분류 모델 및 진행률

분류 모델: 실제 .env CATEGORY_LLM_MODEL 값. OpenWebUI 화면에서 선택한 채팅 모델과 독립적입니다. bge-m3가 아닌 채팅/지시 수행 모델을 사용합니다.
주소: CATEGORY_LITELLM_BASE_URL 우선, 빈 경우 LITELLM_BASE_URL. /v1 없으면 붙인 후 /chat/completions 호출. 키: CATEGORY_LITELLM_API_KEY.
경로: 대시보드 backend_v2/categories.py Classifier.classify → LiteLLM → 등록된 모델 서버. OpenWebUI는 질문 본문 조회에 사용하며 이 분류 추론 호출을 중계하지 않습니다.
LiteLLM 로깅이 활성화돼 있으면 분류용 키와 모델로 호출을 확인합니다. end_user는 보내지 않습니다. 대시보드 토큰 통계의 OUI 별칭 필터는 별개입니다. 기존 결과 재사용이나 원문 조회 단계에는 모델 요청이 없을 수 있습니다. 모델 요청 횟수는 배치 호출 시도 횟수이고 HTTP 재시도 수와 다릅니다.
진행률: (처리+원본 확인 필요)/대상 건수. 원본 확인 필요는 분류 성공이 아니며 별도로 표시됩니다. 완료 여부는 작업 상태로 확인합니다. 분류 전 대상 확인 중에는 퍼센트를 임의 표시하지 않습니다.

적용: 현재 최신 backend_v2를 사용하는 경우 frontend_v2/dist 전체만 교체 후 Ctrl+F5. auth/status 404 등 이전 백엔드인 경우 동봉 backend_v2도 함께 적용하고 서버 재시작. 기존 .env, DB, CSV, Conda 환경은 유지. .env.example로 실제 .env를 덮어쓰지 마세요. 재수집·재분류 필수 아님.
검증: 프런트31 테스트/API 빌드 통과. 실제 LiteLLM 설정과 브라우저 동작은 현장 확인 필요.
