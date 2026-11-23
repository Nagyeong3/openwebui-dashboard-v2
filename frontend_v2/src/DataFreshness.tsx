import {useEffect,useState} from 'react';
import type {OverviewPayload} from './live-api';

export type FreshnessSource={asOf:string|null;updating:boolean;status:string;coverageStart?:string|null};
export type Freshness={openwebui:FreshnessSource;tokens:FreshnessSource};
const dateTime=(value:string)=>new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false});

export function freshnessGap(asOf:string|null,end:string|null,now=Date.now()) {
  if(!asOf || !Number.isFinite(Date.parse(asOf)))return null;
  const target=end?Math.min(Date.parse(end+'T00:00:00+09:00')+86400000,now):now;
  const from=Date.parse(asOf);
  return target-from>15*60000?{from:new Date(from).toISOString(),to:new Date(target).toISOString()}:null;
}

export default function DataFreshness({data}:{data:OverviewPayload}) {
  const [now,setNow]=useState(()=>Date.now());
  useEffect(()=>{const t=setInterval(()=>setNow(Date.now()),60000);return()=>clearInterval(t);},[]);
  const sources:Freshness=data.freshness??{
    openwebui:{asOf:data.updatedAt,updating:!!data.dataState.activeRunId,status:data.dataState.stale?'failed':'ready'},
    tokens:{asOf:data.integrations.tokens.updatedAt??null,updating:false,status:data.integrations.tokens.status},
  };
  const warnings=Object.entries(sources).flatMap(([key,s])=>{
    const label=key==='openwebui'?'사용자·질문':'토큰',gap=freshnessGap(s.asOf,data.period.end,now);
    if(!s.asOf)return [`${label}: 아직 수집된 데이터가 없습니다.`];
    const result=[];
    if(s.status==='failed')result.push(`${label}: 최근 업데이트가 완료되지 않아 마지막 성공 데이터를 표시합니다.`);
    if(gap){
      const rangeStart=data.period.start?Date.parse(data.period.start+'T00:00:00+09:00'):0;
      const from= Math.max(Date.parse(gap.from),rangeStart);
      if(from<Date.parse(gap.to))result.push(`${label}: ${dateTime(new Date(from).toISOString())} ~ ${dateTime(gap.to)} 활동이 아직 반영되지 않았을 수 있습니다.`);
    }
    if(s.coverageStart && data.period.start && Number(s.coverageStart)>Date.parse(data.period.start+'T00:00:00+09:00')/1000)
      result.push(`${label}: 선택 기간 시작일보다 수집 시작일이 늦어 과거 일부 데이터가 없습니다.`);
    return result;
  });
  return <section className="data-freshness" aria-label="데이터 최신화 상태">
    <div className="data-freshness-sources">{Object.entries(sources).map(([key,s])=><span key={key}>
      <strong>{key==='openwebui'?'사용자·질문':'토큰'} 데이터 기준</strong> {s.asOf?dateTime(s.asOf):'수집 전'}
      {s.updating&&<span className="operations-state running">업데이트 진행 중</span>}
    </span>)}</div>
    {warnings.length>0&&<div className="data-freshness-warning" role="status"><strong>선택 기간의 일부 데이터가 미반영될 수 있습니다.</strong>{warnings.map(w=><p key={w}>{w}</p>)}<p>기간을 변경해도 데이터를 새로 수집하지는 않습니다. 운영 업데이트에서 수집 상태를 확인하세요.</p></div>}
  </section>;
}
