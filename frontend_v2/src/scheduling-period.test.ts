import {test} from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadPeriodPreference,savePeriodPreference,PERIOD_STORAGE_KEY} from './period-preferences';
import {defaultQuery,initialQuery} from './live-api';
import PeriodPicker from './PeriodPicker';
import DataFreshness,{freshnessGap,requiresUpdate} from './DataFreshness';
import {formatDateMinute} from './date-format';

function storage(){const values=new Map<string,string>();return {getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);}};}
test('period preferences restore valid custom dates, moving presets, and handle corrupt/blocked storage',()=>{
  const s=storage();assert.equal(loadPeriodPreference(s).range,'month');
  savePeriodPreference({range:'custom',start:'2026-11-01',end:'2026-11-20'},s);
  assert.deepEqual(loadPeriodPreference(s),{range:'custom',start:'2026-11-01',end:'2026-11-20'});
  savePeriodPreference({range:'month',start:'2026-10-01',end:'2026-10-31'},s);
  assert.deepEqual(loadPeriodPreference(s),{range:'month',start:'',end:''});
  s.setItem(PERIOD_STORAGE_KEY,'{bad');assert.equal(loadPeriodPreference(s).range,'month');
  s.setItem(PERIOD_STORAGE_KEY,JSON.stringify({range:'custom',start:'2026-02-30',end:'2026-03-01'}));
  assert.equal(loadPeriodPreference(s).range,'month');
  const blocked={getItem:()=>{throw Error('blocked');},setItem:()=>{throw Error('blocked');}};
  assert.equal(loadPeriodPreference(blocked).range,'month');
  assert.doesNotThrow(()=>savePeriodPreference(defaultQuery,blocked));
});
test('URL period has priority over saved preferences',()=>{
  const before=Object.getOwnPropertyDescriptor(globalThis,'window');
  const s=storage();savePeriodPreference({range:'custom',start:'2026-11-01',end:'2026-11-20'},s);
  Object.defineProperty(globalThis,'window',{configurable:true,value:{localStorage:s}});
  try{
    assert.equal(initialQuery('').range,'custom');
    assert.equal(initialQuery('?range=all').range,'all');
    assert.equal(initialQuery('?start=2026-10-01&end=2026-10-31').start,'2026-10-01');
    assert.equal(initialQuery('?screen=users').end,'2026-11-20');
  }finally{if(before)Object.defineProperty(globalThis,'window',before);else Reflect.deleteProperty(globalThis,'window');}
});
test('custom period trigger shows selected dates rather than the menu label',()=>{
  const html=renderToStaticMarkup(React.createElement(PeriodPicker,{q:{...defaultQuery,range:'custom',start:'2026-11-01',end:'2026-11-20'},onChange:()=>{}}));
  assert.match(html,/2026\.11\.01 ~ 2026\.11\.20/);assert.doesNotMatch(html,/>기간 지정</);
});
test('freshness gaps use source watermarks, not latest messages, and respect historical periods and short delays',()=>{
  const now=Date.parse('2026-11-23T12:00:00+09:00');
  assert.ok(freshnessGap('2026-11-16T08:30:00+09:00','2026-11-23',now));
  assert.equal(freshnessGap('2026-11-16T08:30:00+09:00','2026-11-15',now),null);
  assert.equal(freshnessGap('2026-11-23T11:50:00+09:00','2026-11-23',now),null);
  assert.equal(freshnessGap(null,'2026-11-23',now),null);
  const html=renderToStaticMarkup(React.createElement(DataFreshness,{data:{updatedAt:'2026-11-16T08:30:00+09:00',period:{start:'2026-11-01',end:'2026-11-23'},dataState:{activeRunId:'running',stale:false},integrations:{tokens:{status:'not-synced'}}} as any}));
  assert.match(html,/선택 기간/);assert.match(html,/사용량 데이터 기준/);assert.match(html,/토큰 데이터 기준/);
  assert.match(html,/업데이트 필요/);assert.match(html,/data-update-needed/);assert.match(html,/<svg/);
  assert.doesNotMatch(html,/미반영|아직 수집된|기간을 변경해도|업데이트 진행 중|최근 업데이트/);
  const covered={period:{start:'2026-11-01',end:'2026-11-15'},freshness:{openwebui:{asOf:'2026-11-16T08:30:00+09:00',status:'failed',updating:false},tokens:{asOf:'2026-11-16T08:30:00+09:00',status:'ready',updating:false}}} as any;
  assert.equal(requiresUpdate(covered,now),false);
  const coveredHtml=renderToStaticMarkup(React.createElement(DataFreshness,{data:covered}));
  assert.doesNotMatch(coveredHtml,/업데이트 필요/);
  covered.freshness.tokens.coverageStart=String(Date.parse('2026-11-10T00:00:00+09:00')/1000);
  assert.equal(requiresUpdate(covered,now),true);
});

test('all date-time labels stop at minutes and use Korean time',()=>{
  const at=formatDateMinute('2026-11-22T23:30:00+00:00');
  assert.equal(at,formatDateMinute('2026-11-22T23:30:59+00:00'));
  assert.match(at,/2026.*11.*23/);assert.match(at,/08:30$/);
  assert.doesNotMatch(at,/\d{2}:\d{2}:\d{2}/);
  assert.equal(formatDateMinute(null),'—');
});
