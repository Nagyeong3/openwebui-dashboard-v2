import { useState } from 'react';
import { number } from './domain';
import type {Query} from './live-api';
export type RankFields={reportRank?:number;previousRank?:number|null;previousQuestions?:number|null;rankChange?:number|null;rankChangeStatus?:string;questionChange?:number|null};
export type LeaderComparison={start:string|null;end:string|null;status:string;sameLength:boolean};
export function rankMovement(r:RankFields){
  if(r.rankChangeStatus==='unavailable'||r.rankChange==null)return '—';
  return r.rankChange>0?`▲ ${r.rankChange}`:r.rankChange<0?`▼ ${Math.abs(r.rankChange)}`:'0';
}
export function RankMovement({row}:{row:RankFields}){
  return <span className={'rank-movement '+(row.rankChange&&row.rankChange>0?'up':row.rankChange&&row.rankChange<0?'down':'')} title={row.previousRank!=null?`이전 ${row.previousRank}위 · 질문 ${number(row.previousQuestions??0)}건`:'비교 가능한 이전 사용 기록 없음'}>{rankMovement(row)}</span>;
}
export function compactTokens(n:number){
  const rounded=(v:number)=>Number(v.toFixed(2)).toLocaleString('en-US');
  return n>=1e6?rounded(n/1e6)+'M':n>=1e3?rounded(n/1e3)+'K':number(n);
}
export function TokenCount({value}:{value:number|null|undefined}){
  return <span className="token-count" tabIndex={value==null?undefined:0} title={value==null?undefined:number(value)+' 토큰'} aria-label={value==null?'사용량 없음':number(value)+' 토큰'}>{value==null?'—':compactTokens(value)}</span>;
}
export function RankComparison({q,onChange,comparison,currentStart}:{q:Query;onChange:(p:Partial<Query>)=>void;comparison?:LeaderComparison;currentStart?:string|null}){
  const [start,setStart]=useState(q.compareStart||''),[end,setEnd]=useState(q.compareEnd||'');
  const [error,setError]=useState('');
  return <div className="rank-comparison"><span>순위 비교 {comparison?.start?`${comparison.start} ~ ${comparison.end}`:'기간 미지정'}</span>
    <details><summary>비교 기간 설정</summary><form onSubmit={e=>{e.preventDefault();if(!start||!end||start>end||(currentStart&&end>=currentStart)){setError('비교 기간을 현재 조회 기간 이전으로 선택하세요.');return;}setError('');onChange({compareStart:start,compareEnd:end});}}>
    <label>비교 시작일<input type="date" value={start} onChange={e=>setStart(e.target.value)} required/></label><label>비교 종료일<input type="date" value={end} onChange={e=>setEnd(e.target.value)} required/></label><button className="button" type="submit">적용</button><button className="button" type="button" onClick={()=>{setStart('');setEnd('');setError('');onChange({compareStart:'',compareEnd:''});}}>직전 동일 기간</button>{error&&<p role="alert">{error}</p>}</form></details>
    {comparison?.start&&<span>현재 명부 기준 · 질문 수 동점은 공동 순위</span>}
    {comparison?.status==='all-time'&&<span>순위를 비교하려면 조회 기간을 선택하세요.</span>}
    {comparison?.status==='no-history'&&<span>이전 기간 데이터 없음</span>}
    {comparison?.start&&!comparison.sameLength&&<span>기간 길이가 다릅니다.</span>}
  </div>;
}
