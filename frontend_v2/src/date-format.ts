const minuteFormatter = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function formatDateMinute(value: string | number | Date | null | undefined, empty = '—'): string {
  if (value == null || value === '') return empty;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? minuteFormatter.format(date) : empty;
}

export function seoulDateKey(value: string | number | Date): string | null {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  const parts = Object.fromEntries(minuteFormatter.formatToParts(date).map(p => [p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
