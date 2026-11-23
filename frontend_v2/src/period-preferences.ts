import type {Query} from './live-api';

export const PERIOD_STORAGE_KEY = 'oui-dashboard-period-v1';
export type PeriodPreference = Pick<Query, 'range'|'start'|'end'>;
type StorageAccess = Pick<Storage, 'getItem'|'setItem'>;

export function validPeriod(start: string, end: string): boolean {
  const parse = (s: string) => /^(?!0000)\d{4}-\d{2}-\d{2}$/.test(s)
    && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0,10) === s;
  return parse(start) && parse(end) && start <= end && (Date.parse(end)-Date.parse(start))/86400000 < 3660;
}

function preference(value: unknown): PeriodPreference | null {
  if (!value || typeof value !== 'object') return null;
  const p=value as PeriodPreference;
  if (!['month','7d','30d','90d','all','custom'].includes(p.range)) return null;
  if (p.range==='custom') return typeof p.start==='string' && typeof p.end==='string' && validPeriod(p.start,p.end)
    ? {range:'custom',start:p.start,end:p.end} : null;
  return {range:p.range,start:'',end:''};
}

export function loadPeriodPreference(storage?: StorageAccess): PeriodPreference {
  try {
    const raw=(storage ?? window.localStorage).getItem(PERIOD_STORAGE_KEY);
    if (raw) {const p=preference(JSON.parse(raw));if(p)return p;}
  } catch { /* Disabled storage, SSR, malformed/expired data: use the calendar default. */ }
  return {range:'month',start:'',end:''};
}

export function savePeriodPreference(value: PeriodPreference, storage?: StorageAccess): void {
  try {const p=preference(value);if(p)(storage ?? window.localStorage).setItem(PERIOD_STORAGE_KEY,JSON.stringify(p));}
  catch { /* Browsing and period selection still work when persistence is blocked. */ }
}
