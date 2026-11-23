import {useEffect,useState} from 'react';
import {AlertTriangle} from 'lucide-react';
import {formatDateMinute} from './date-format';
import type {OverviewPayload} from './live-api';

export type FreshnessSource={asOf:string|null;updating:boolean;status:string;coverageStart?:string|null};
export type Freshness={openwebui:FreshnessSource;tokens:FreshnessSource};

export function freshnessGap(asOf:string|null,end:string|null,now=Date.now()) {
  if(!asOf || !Number.isFinite(Date.parse(asOf)))return null;
  const target=end?Math.min(Date.parse(end+'T00:00:00+09:00')+86400000,now):now;
  const from=Date.parse(asOf);
  return target-from>15*60000?{from:new Date(from).toISOString(),to:new Date(target).toISOString()}:null;
}

function sourcesFor(data:OverviewPayload):Freshness {
  return data.freshness??{
    openwebui:{asOf:data.updatedAt,updating:!!data.dataState.activeRunId,status:data.dataState.stale?'failed':'ready'},
    tokens:{asOf:data.integrations.tokens.updatedAt??null,updating:false,status:data.integrations.tokens.status},
  };
}

export function requiresUpdate(data:OverviewPayload,now=Date.now()):boolean {
  return Object.values(sourcesFor(data)).some(s=>{
    if(!s.asOf || !Number.isFinite(Date.parse(s.asOf)))return true;
    const gap=freshnessGap(s.asOf,data.period.end,now);
    const start=data.period.start?Date.parse(data.period.start+'T00:00:00+09:00'):0;
    return !!(gap && Math.max(Date.parse(gap.from),start)<Date.parse(gap.to))
      || !!(s.coverageStart && data.period.start && Number(s.coverageStart)>start/1000);
  });
}

export default function DataFreshness({data,unconfirmed=false}:{data:OverviewPayload;unconfirmed?:boolean}) {
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(t);},[]);
  const sources=sourcesFor(data);
  return <section className="data-freshness" aria-label="데이터 최신화 상태">
    <div className="data-freshness-sources">
      <span><strong>선택 기간</strong>{data.period.start&&data.period.end?`${data.period.start} ~ ${data.period.end}`:'전체 기간'}</span>
      <span><strong>사용량 데이터 기준</strong>{formatDateMinute(sources.openwebui.asOf)}</span>
      <span><strong>토큰 데이터 기준</strong>{formatDateMinute(sources.tokens.asOf)}</span>
      {(unconfirmed||requiresUpdate(data,now))&&<span className="data-update-needed" role="status"><AlertTriangle size={19} strokeWidth={1.8} aria-hidden="true"/>업데이트 필요</span>}
    </div>
  </section>;
}
