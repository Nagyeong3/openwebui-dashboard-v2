export type MetricComparison = {
  current: number | null;
  previous: number | null;
  changePercent: number | null;
  status: 'available' | 'zero-baseline' | 'no-history' | 'no-roster-history' | 'all-time' | 'not-connected' | 'not-synced' | 'no-value';
  start: string | null;
  end: string | null;
};

export function ComparisonBadge({comparison}: {comparison?: MetricComparison}) {
  if (!comparison) return null;
  const explanations: Record<string, string> = {
    'zero-baseline': '이전 값이 0이어서 증감률을 계산할 수 없습니다.',
    'no-history': '비교 기간의 수집 이력이 부족합니다.',
    'no-roster-history': '과거 사용자 명부가 저장되어 있지 않습니다.',
    'all-time': '전체 기간에는 이전 동일기간이 없습니다.',
    'not-connected': '토큰 사용량이 연결되지 않았습니다.',
    'not-synced': '토큰 비교 데이터 업데이트가 필요합니다.',
    'no-value': '질문이 발생한 채팅방이 없어 평균을 계산할 수 없습니다.',
  };
  const available = comparison.status === 'available' && comparison.changePercent !== null;
  const percent = comparison.changePercent ?? 0;
  const title = available
    ? `${comparison.start} ~ ${comparison.end} 대비 · 이전 ${comparison.previous?.toLocaleString('ko-KR', {maximumFractionDigits: 4})}`
    : explanations[comparison.status] || '비교 데이터가 없습니다.';
  return <span className={'delta ' + (!available || percent === 0 ? 'comparison-neutral' : percent < 0 ? 'down' : '')} title={title} tabIndex={0}
    aria-label={available ? `이전 동일기간 대비 ${percent > 0 ? '증가' : percent < 0 ? '감소' : '변동 없음'} ${Math.abs(percent).toFixed(1)}퍼센트` : title}>
    {available ? `${percent > 0 ? '+' : percent < 0 ? '−' : ''}${Math.abs(percent).toFixed(1)}%` : '비교 불가'}
  </span>;
}
