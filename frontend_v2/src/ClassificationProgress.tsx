import { number } from './domain';

type Props = { processed:number; total:number; unavailable?:number; calls?:number; reused?:number; status:string };
export function classificationProgress(processed:number,total:number,unavailable=0){
  const safe=(v:number)=>Number.isFinite(v)?Math.max(0,v):0;
  const count=Math.min(safe(total),safe(processed)+safe(unavailable));
  return {count,total:safe(total),percent:total>0?Math.floor(count/safe(total)*100):null};
}
export default function ClassificationProgress({processed,total,unavailable=0,calls,reused,status}:Props){
  const p=classificationProgress(processed,total,unavailable);
  const waiting=p.total===0&&status==='running';
  return <div className="classification-progress">
    <div className="classification-progress-heading"><strong>질문 분류 진행률</strong><strong>{p.percent===null?(waiting?'대상 확인 중':'대상 없음'):`${p.percent}%`}</strong></div>
    {p.total>0?<progress className="category-progress" aria-label="질문 분류 진행률" value={p.count} max={p.total}/>:waiting?<progress className="category-progress" aria-label="분류 대상 확인 중"/>:null}
    <div className="classification-progress-counts"><span>처리 {number(processed)} / {number(p.total)}건</span>{unavailable>0&&<span>원본 확인 필요 {number(unavailable)}건</span>}{calls!==undefined&&<span>모델 요청 {number(calls)}회</span>}{reused!==undefined&&<span>결과 재사용 {number(reused)}건</span>}</div>
  </div>;
}
