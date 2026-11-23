import type {RankFields,LeaderComparison} from "./Reporting";
import { request } from "./api";
import {loadPeriodPreference} from './period-preferences';

export type View = "user" | "team" | "leader";
export type Query = {
  compareStart?:string;
  compareEnd?:string;
  range: string;
  start: string;
  end: string;
  division: string;
  team: string;
  position: string;
  matchStatus: string;
  view: View;
  page: number;
  pageSize: number;
  order: "asc" | "desc";
  search: string;
  model: string;
};
export type Person = RankFields & {
  id: string;
  name: string;
  email: string;
  division: string;
  team: string;
  position: string;
  mapping: string;
  questions: number;
  chats: number;
  attachments: number;
  rank: number;
  lastUsedAt: string | null;
  primaryModel: string | null;
};
export type Team = {
  division: string;
  team: string;
  users: number;
  activeUsers: number;
  questions: number;
  chats: number;
  attachmentQuestions: number;
};
export type LeaderRank = RankFields & Pick<
  Person,
  "id" | "name" | "team" | "position" | "questions" | "rank"
>;
export type Payload = {
  leaderRanking?: LeaderRank[] | null;
  leaderComparison?:LeaderComparison;
  schemaVersion: number;
  source: string;
  updatedAt: string;
  period: { start: string | null; end: string | null; timezone: string };
  dataState: {
    ready: boolean;
    stale: boolean;
    activeRunId: string | null;
    organization: string;
    questionPolicy: string;
  };
  filters: {
    divisions: string[];
    teams: string[];
    positions: string[];
    matchStatuses: string[];
  };
  summary: {
    users: number;
    activeUsers: number;
    zeroUsageUsers: number;
    questions: number;
    chats: number;
    attachmentQuestions: number;
  };
  daily: { date: string; questions: number }[];
  detail: {
    view: View;
    records: (Person | Team)[];
    total: number;
    page: number;
    pageSize: number;
  };
};
export const defaultQuery: Query = {
  range: "month",
  start: "",
  end: "",
  division: "전체",
  team: "전체",
  position: "전체",
  matchStatus: "전체",
  view: "user",
  page: 1,
  pageSize: 50,
  order: "desc",
  search: "",
  model: "전체",
};
export function readQuery(search: string): Query {
  const p = new URLSearchParams(search),
    q = { ...defaultQuery };
  for (const k of [
    "model",
    "division",
    "team",
    "position",
    "matchStatus",
    "search",
    "start",
    "end",
  ] as const)
    q[k] = p.get(k) ?? q[k];
  if (
    ["all", "7d", "month", "30d", "90d", "custom"].includes(
      p.get("range") || "",
    )
  )
    q.range = p.get("range")!;
  q.compareStart=p.get("compareStart")||"";q.compareEnd=p.get("compareEnd")||"";
  if (!p.has("range") && q.start && q.end) q.range = "custom";
  if (["user", "team", "leader"].includes(p.get("view") || ""))
    q.view = p.get("view") as View;
  if (p.get("order") === "asc") q.order = "asc";
  if (/^[1-9]\d*$/.test(p.get("page") || "")) q.page = Number(p.get("page"));
  if ([10, 25, 50, 100].includes(Number(p.get("pageSize"))))
    q.pageSize = Number(p.get("pageSize"));
  return q;
}
export function initialQuery(search: string): Query {
  const q=readQuery(search), p=new URLSearchParams(search);
  // Shared links and browser history take priority over this browser's preference.
  return p.has('range') || p.has('start') || p.has('end') ? q : {...q,...loadPeriodPreference()};
}
export function queryParams(q: Query): URLSearchParams {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(q)) {
    if(v===undefined)continue;
    if (k === "start" || k === "end") {
      if (q.range === "custom") p.set(k, String(v));
    } else if (!(k === "range" && q.range === "custom")) p.set(k, String(v));
  }
  return p;
}
const count = (v: unknown) =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const text = (v: unknown) => typeof v === "string";
const nullableText = (v: unknown) => v === null || text(v);
export function validateUsers(value: unknown): asserts value is Payload {
  const p = value as Payload;
  const fail = () => {
    throw new Error(
      "사용자 API 응답 형식이 맞지 않습니다. 백엔드 버전을 확인하세요.",
    );
  };
  if (
    !p ||
    p.schemaVersion !== 1 ||
    p.source !== "openwebui-api-cache" ||
    !text(p.updatedAt) ||
    !Number.isFinite(Date.parse(p.updatedAt)) ||
    !p.dataState ||
    p.dataState.ready !== true ||
    typeof p.dataState.stale !== "boolean" ||
    !nullableText(p.dataState.activeRunId) ||
    !text(p.dataState.organization) ||
    !text(p.dataState.questionPolicy) ||
    !p.period ||
    p.period.timezone !== "Asia/Seoul" ||
    !nullableText(p.period.start) ||
    !nullableText(p.period.end) ||
    !p.filters ||
    !p.summary ||
    !p.detail ||
    !Array.isArray(p.daily)
  )
    fail();
  for (const k of ["divisions", "teams", "positions", "matchStatuses"] as const)
    if (!Array.isArray(p.filters[k]) || !p.filters[k].every(text)) fail();
  for (const k of [
    "users",
    "activeUsers",
    "zeroUsageUsers",
    "questions",
    "chats",
    "attachmentQuestions",
  ] as const)
    if (!count(p.summary[k])) fail();
  if (
    !["user", "team", "leader"].includes(p.detail.view) ||
    !count(p.detail.total) ||
    !count(p.detail.page) ||
    p.detail.page < 1 ||
    !count(p.detail.pageSize) ||
    p.detail.pageSize < 1 ||
    !Array.isArray(p.detail.records) ||
    p.detail.records.length > p.detail.pageSize
  )
    fail();
  const ids = new Set();
  for (const r of p.detail.records) {
    if (
      !r ||
      ![r.division, r.team].every(text) ||
      ![r.questions, r.chats].every(count)
    )
      fail();
    if (p.detail.view === "team") {
      const t = r as Team;
      if (![t.users, t.activeUsers, t.attachmentQuestions].every(count)) fail();
    } else {
      const u = r as Person;
      if (
        ![u.id, u.name, u.email, u.position, u.mapping].every(text) ||
        !u.id ||
        ids.has(u.id) ||
        !count(u.rank) ||
        u.rank < 1 ||
        !count(u.attachments) ||
        !nullableText(u.lastUsedAt) ||
        !nullableText(u.primaryModel)
      )
        fail();
      ids.add(u.id);
    }
  }
  for (const d of p.daily)
    if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !count(d.questions))
      fail();
}
export async function loadUsers(
  q: Query,
  token: string,
  signal?: AbortSignal,
): Promise<Payload> {
  if (q.range === "custom" && (!q.start || !q.end || q.start > q.end))
    throw new Error("조회 시작일과 종료일을 확인하세요.");
  const data = await request("/api/dashboard/v2/users?" + queryParams(q), {
    signal,
    headers: token ? { Authorization: "Bearer " + token } : {},
  });
  validateUsers(data);
  if (
    data.detail.view !== q.view ||
    data.detail.page !== q.page ||
    data.detail.pageSize !== q.pageSize
  )
    throw new Error("요청한 보기/페이지와 API 응답이 다릅니다.");
  if (q.view === "leader") validateLeaderRanking(data);
  return data;
}
export function validateLeaderRanking(data: Payload) {
  const rows = data.leaderRanking;
  if (!Array.isArray(rows) || rows.length !== data.detail.total)
    throw new Error(
      "전체 팀장 그래프 응답이 없습니다. 최신 백엔드로 업데이트하세요.",
    );
  const ids = new Set<string>();
  for (const r of rows) {
    if (
      !r ||
      ![r.id, r.name, r.team, r.position].every(text) ||
      !r.id ||
      ids.has(r.id) ||
      !count(r.questions) ||
      !count(r.rank) ||
      r.rank < 1
    )
      throw new Error("팀장 순위 응답 형식이 맞지 않습니다.");
    ids.add(r.id);
  }
}

export type Screen = "overview" | "users" | "tokens" | "categories" | "operations";
export function readScreen(search: string): Screen {
  const p = new URLSearchParams(search);
  if (p.get("screen") === "operations") return "operations";
  if (p.get("screen") === "categories") return "categories";
  if (p.get("screen") === "tokens") return "tokens";
  if (p.get("screen") === "overview") return "overview";
  // Preserve old bookmarked user/leader views; no separate team/leader pages.
  return p.get("screen") === "users" || p.has("view") ? "users" : "overview";
}
export function userQuery(q: Query): Query {
  return { ...q, view: q.view === "leader" ? "leader" : "user" };
}
export function periodParams(q: Query): URLSearchParams {
  const p = new URLSearchParams();
  if (q.range === "custom") {
    p.set("start", q.start);
    p.set("end", q.end);
  } else p.set("range", q.range);
  return p;
}
export type OverviewPayload = Pick<
  Payload,
  "schemaVersion" | "source" | "period" | "updatedAt" | "dataState" | "daily"
> & {
  freshness?: import('./DataFreshness').Freshness;
  metricComparisons?: Record<string, import('./Comparison').MetricComparison>;
  summary: Payload["summary"] & {
    averageQuestionsPerChat: number | null;
    leaders: number;
    activeLeaders: number;
  };
  comparison: {
    status: "available" | "zero-baseline" | "all-time";
    start: string | null;
    end: string | null;
    questions: number | null;
    changePercent: number | null;
  };
  leaderComparison?:LeaderComparison;
  activity30d?:{start:string;end:string;days:number;users:number;dailyAverage:number;basis:string};
  weeklyResponses?:{records:{start:string;end:string;responses:number;partial:boolean}[];total:number;peak:number;basis:string;weekStartsOn:string};
  leaderTop10: Person[];
  integrations: {
    tokens: {
      status: "not-connected" | "not-synced" | "ready";
      source: "litellm";
      total: number | null;
      input: number | null;
      output: number | null;
      requests: number | null;
      averagePerRequest: number | null;
      costUsd: number | null;
      missingCostRequests?: number;
      stale?: boolean;
      updatedAt?: string;
    };
    categories: {
      status: "not-connected" | "not-synced" | "ready";
      source: "embedding-classifier" | "litellm-classifier";
      records: {name:string;value:number;percent:number}[] | null;
      classified: number | null;
      questions?: number;
      pending?: number;
    };
  };
};
export function validateOverview(
  value: unknown,
): asserts value is OverviewPayload {
  const p = value as OverviewPayload;
  const fail = () => {
    throw new Error(
      "개요 API 응답 형식이 맞지 않습니다. 백엔드 버전을 확인하세요.",
    );
  };
  if (
    !p ||
    !p.summary ||
    !Array.isArray(p.leaderTop10) ||
    p.leaderTop10.length > 10
  )
    fail();
  validateUsers({
    ...p,
    filters: { divisions: [], teams: [], positions: [], matchStatuses: [] },
    detail: {
      view: "leader",
      total: p.summary.leaders,
      page: 1,
      pageSize: 10,
      records: p.leaderTop10,
    },
  });
  if (
    !count(p.summary.leaders) ||
    !count(p.summary.activeLeaders) ||
    p.summary.activeLeaders > p.summary.leaders ||
    p.summary.leaders > p.summary.users ||
    p.leaderTop10.length !== Math.min(p.summary.leaders, 10)
  )
    fail();
  if (
    p.summary.averageQuestionsPerChat !== null &&
    (typeof p.summary.averageQuestionsPerChat !== "number" ||
      !Number.isFinite(p.summary.averageQuestionsPerChat) ||
      p.summary.averageQuestionsPerChat < 0)
  )
    fail();
  const c = p.comparison;
  if (
    !c ||
    !["available", "zero-baseline", "all-time"].includes(c.status) ||
    !nullableText(c.start) ||
    !nullableText(c.end)
  )
    fail();
  if (
    c.status === "available"
      ? !count(c.questions) ||
        !c.questions ||
        typeof c.changePercent !== "number" ||
        !Number.isFinite(c.changePercent)
      : c.changePercent !== null
  )
    fail();
  if (
    c.status === "all-time"
      ? c.questions !== null || c.start !== null || c.end !== null
      : !count(c.questions) || !c.start || !c.end
  )
    fail();
  if (c.status === "zero-baseline" && c.questions !== 0) fail();
  if(p.activity30d){const a=p.activity30d;if(!text(a.start)||!text(a.end)||a.days!==30||!count(a.users)||!Number.isFinite(a.dailyAverage)||a.dailyAverage<0)fail();}
  if(p.freshness)for(const key of ['openwebui','tokens'] as const){
    const s=p.freshness[key];if(!s||!nullableText(s.asOf)||(s.asOf!==null&&!Number.isFinite(Date.parse(s.asOf)))||typeof s.updating!=='boolean'||typeof s.status!=='string')fail();
  }
  if(p.metricComparisons){
    const keys=['activeUsers','questions','tokens','users','chats','attachmentQuestions','averageQuestionsPerChat','activeLeaders','activity30dUsers','dailyAverage'];
    for(const key of keys){
      const m=p.metricComparisons[key];
      if(!m||!['available','zero-baseline','no-history','no-roster-history','all-time','not-connected','not-synced','no-value'].includes(m.status)||!nullableText(m.start)||!nullableText(m.end))fail();
      if([m.current,m.previous].some(v=>v!==null&&(!Number.isFinite(v)||v<0)))fail();
      if(m.status==='available'?m.current===null||m.previous===null||!Number.isFinite(m.changePercent)||m.changePercent===null:m.changePercent!==null)fail();
    }
  }
  if(p.weeklyResponses){const w=p.weeklyResponses;if(!Array.isArray(w.records)||!count(w.total)||!count(w.peak)||w.records.some(r=>!text(r.start)||!text(r.end)||!count(r.responses)||typeof r.partial!=='boolean')||w.records.reduce((n,r)=>n+r.responses,0)!==w.total||Math.max(0,...w.records.map(r=>r.responses))!==w.peak)fail();}
  const t = p.integrations?.tokens,
    categories = p.integrations?.categories;
  const finite = (v: unknown) =>
    v === null || (typeof v === "number" && Number.isFinite(v) && v >= 0);
  if (
    !t ||
    !["ready", "not-connected", "not-synced"].includes(t.status) ||
    t.source !== "litellm" ||
    ![
      t.total,
      t.input,
      t.output,
      t.requests,
      t.averagePerRequest,
      t.costUsd,
    ].every(finite) ||
    (t.status !== "ready" &&
      [
        t.total,
        t.input,
        t.output,
        t.requests,
        t.averagePerRequest,
        t.costUsd,
      ].some((v) => v !== null)) ||
    !categories ||
    !["not-connected","not-synced","ready"].includes(categories.status) ||
    !["embedding-classifier","litellm-classifier"].includes(categories.source) ||
    (categories.status === "ready"
      ? !Array.isArray(categories.records) || !count(categories.classified) || categories.records.some(r=>typeof r.name!=="string" || !count(r.value) || !Number.isFinite(r.percent) || r.percent<0 || r.percent>100) || categories.records.reduce((n,r)=>n+r.value,0)!==p.summary.questions
      : categories.records !== null || categories.classified !== null)
  )
    fail();
}
export async function loadOverview(
  q: Query,
  token: string,
  signal?: AbortSignal,
): Promise<OverviewPayload> {
  if (q.range === "custom" && (!q.start || !q.end || q.start > q.end))
    throw new Error("조회 시작일과 종료일을 확인하세요.");
  const params=periodParams(q);
  if(q.compareStart&&q.compareEnd){params.set("compareStart",q.compareStart);params.set("compareEnd",q.compareEnd);}
  const result = await request(
    "/api/dashboard/v2/overview?" + params,
    { signal, headers: token ? { Authorization: "Bearer " + token } : {} },
  );
  validateOverview(result);
  return result;
}
export function leaderQuery(
  q: Query,
  period: OverviewPayload["period"],
): Query {
  return {
    ...defaultQuery,
    compareStart:q.compareStart||"", compareEnd:q.compareEnd||"",
    range: q.range,
    start: q.start,
    end: q.end,
    ...(period.start && period.end
      ? { range: "custom", start: period.start, end: period.end }
      : {}),
    view: "leader",
    order: "desc",
  };
}
export function overviewCsv(p: OverviewPayload): string {
  const escape = (v: string | number | null) => {
    let s = v === null ? "" : String(v);
    if (typeof v === "string" && /^\s*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  const rows: (string | number | null)[][] = [
    [
      "OpenWebUI 개요",
      "시작일",
      p.period.start,
      "종료일",
      p.period.end,
      "마지막 성공 수집",
      p.updatedAt,
    ],
    ["지표", "값"],
    ["전체 사용자 수", p.summary.users],
    ["활성 사용자", p.summary.activeUsers],
    ["총 질문 수", p.summary.questions],
    ["총 채팅방 수", p.summary.chats],
    ["파일 첨부 질문", p.summary.attachmentQuestions],
    ["평균 질문/채팅방", p.summary.averageQuestionsPerChat],
    ["활성 팀장", p.summary.activeLeaders],
    ["이전 기간 시작일", p.comparison.start],
    ["이전 기간 종료일", p.comparison.end],
    ["이전 기간 질문 수", p.comparison.questions],
    ["질문 증감률 (%)", p.comparison.changePercent],
    [
      "토큰·비용 상태",
      p.integrations.tokens.status === "ready" ? "연동 완료" : "연동 준비 중",
    ],
    ["총 토큰", p.integrations.tokens.total],
    ["추정 비용 USD", p.integrations.tokens.costUsd],
    ["질문 카테고리", "분류 준비 중"],
    [],
    ["날짜", "질문 수"],
    ...p.daily.map((d) => [d.date, d.questions]),
    [],
    ["팀장 Top 10 순위", "사용자명", "실 / 본부", "팀", "질문 수", "채팅방 수", "이전 순위", "순위 증감", "질문 증감"],
    ...p.leaderTop10.map((r) => [
      r.reportRank??r.rank,
      r.name,
      r.division,
      r.team,
      r.questions,
      r.chats, r.previousRank??null,r.rankChange??null,r.questionChange??null,
    ]),
  ];
  if(p.leaderComparison)rows.push([],['순위 비교 시작일',p.leaderComparison.start],['순위 비교 종료일',p.leaderComparison.end]);
  if(p.freshness)rows.push([],['사용자·질문 데이터 기준',p.freshness.openwebui.asOf],['토큰 데이터 기준',p.freshness.tokens.asOf]);
  if(p.activity30d)rows.push([],['접속자 집계 시작',p.activity30d.start],['접속자 집계 종료',p.activity30d.end],['최근 30일간 접속자',p.activity30d.users],['일일 사용자 평균',p.activity30d.dailyAverage]);
  if(p.metricComparisons){
    const labels:Record<string,string>={activeUsers:'활성 사용자',questions:'총 질문 수',tokens:'총 토큰',users:'전체 사용자 수',chats:'총 채팅방 수',attachmentQuestions:'파일 첨부 질문',averageQuestionsPerChat:'평균 질문/채팅방',activeLeaders:'활성 팀장',activity30dUsers:'최근 30일간 접속자',dailyAverage:'일일 사용자 평균'};
    const statuses:Record<string,string>={available:'비교 가능','zero-baseline':'이전 값 0','no-history':'이전 수집 이력 부족','no-roster-history':'과거 사용자 명부 없음','all-time':'전체 기간','not-connected':'연동 필요','not-synced':'업데이트 필요','no-value':'평균 산정 불가'};
    rows.push([],['지표','현재 값','이전 값','증감률 (%)','비교 시작일','비교 종료일','비교 상태'],...Object.entries(p.metricComparisons).map(([key,m])=>[labels[key]||key,m.current,m.previous,m.changePercent,m.start,m.end,statuses[m.status]]));
  }
  if(p.weeklyResponses)rows.push([],['주간 시작','주간 종료','모델 응답 수','일부 기간'],...p.weeklyResponses.records.map(r=>[r.start,r.end,r.responses,r.partial?'예':'아니오']),['기간 모델 응답 총계',p.weeklyResponses.total],['최고 주간 응답',p.weeklyResponses.peak]);
  return "\ufeff" + rows.map((r) => r.map(escape).join(",")).join("\r\n");
}
