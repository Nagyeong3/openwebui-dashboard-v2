import {TokenCount,RankComparison,RankMovement,rankMovement} from "./Reporting";
import {ComparisonBadge} from './Comparison';
import DataFreshness from './DataFreshness';
import { useEffect, useState } from "react";
import { CategoryDistribution } from "./Categories";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  BarChart3,
  CircleDollarSign,
  Layers3,
  Loader2,
  MessageSquare,
  Paperclip,
  PieChart,
  Table2,
  Users,
} from "lucide-react";
import {
  Chart,
  Empty,
  Metric,
  Panel,
  barOption,
  lineOption,
} from "./components";
import { number } from "./domain";
import {
  leaderQuery,
  loadOverview,
  overviewCsv,
  periodParams,
  type OverviewPayload,
  type Query,
} from "./live-api";

type Mode = "table" | "chart";
function ModeToggle({
  label,
  mode,
  onChange,
}: {
  label: string;
  mode: Mode;
  onChange: (mode: Mode) => void;
}) {
  return (
    <div
      className="overview-toggle"
      role="group"
      aria-label={label + " 표시 방식"}
    >
      <span
        className={"overview-toggle-thumb " + (mode === "chart" ? "right" : "")}
        aria-hidden="true"
      />
      {(["table", "chart"] as const).map((m) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          onClick={() => onChange(m)}
        >
          {m === "table" ? <Table2 size={14} /> : <BarChart3 size={14} />}{" "}
          {m === "table" ? "표" : "그래프"}
        </button>
      ))}
    </div>
  );
}
function Pending({ category = false }: { category?: boolean }) {
  return (
    <div className="overview-pending" role="status">
      {category ? <PieChart size={32} /> : <Layers3 size={32} />}
      <strong>
        {category ? "분류 결과가 없습니다" : "사용량이 없습니다"}
      </strong>
      <p>
        {category
          ? "카테고리 화면에서 질문 분류를 실행하면 분포가 표시됩니다."
          : "토큰과 비용은 LiteLLM 로그 연결 후 표시됩니다."}
      </p>
    </div>
  );
}
export default function Overview({
  q,
  token,
  revision,
  dark,
  onLeaders,
  onPeriod,
  onChange,
}: {
  q: Query;
  onChange:(p:Partial<Query>)=>void;
  token: string;
  revision: number;
  dark: boolean;
  onLeaders: (q: Query) => void;
  onPeriod?: (period: OverviewPayload["period"]) => void;
}) {
  const [state, setState] = useState<{
    key: string;
    data?: OverviewPayload;
    error?: string;
  }>({ key: "" });
  const [dailyMode, setDailyMode] = useState<Mode>("chart"),
    [leaderMode, setLeaderMode] = useState<Mode>("table"),
    [categoryMode, setCategoryMode] = useState<Mode>("chart");
  const [dailyPage, setDailyPage] = useState(1);
  const key = periodParams(q).toString() + "|" + token + "|" + revision + "|" + (q.compareStart||"") + "|" + (q.compareEnd||"");
  useEffect(() => {
    const c = new AbortController();
    let timer:ReturnType<typeof setTimeout>;
    setDailyPage(1);
    function poll(){loadOverview(q, token, c.signal)
      .then((data) => {
        if (!c.signal.aborted) {
          setState({ key, data });
          onPeriod?.(data.period);
          timer=setTimeout(poll,data.freshness?.openwebui.updating||data.freshness?.tokens.updating?5000:30000);
        }
      })
      .catch((e) => {
        if (!c.signal.aborted)
          {setState(old=>({...(old.key===key?old:{}),key,error:e instanceof Error?e.message:'개요 조회 실패'}));timer=setTimeout(poll,10000);}
      });
    }
    poll();
    return () => {c.abort();clearTimeout(timer);};
  }, [key]);
  const data = state.key === key ? state.data : undefined,
    error = state.key === key ? state.error : undefined;
  if (error && !data)
    return (
      <div className="error-state" role="alert">
        <AlertTriangle size={28} />
        <h2>개요를 불러올 수 없습니다</h2>
        <p>{error}</p>
        <RankComparison q={q} onChange={onChange}/>
        <p>
          연결 상태를 확인하고 다시 불러오세요.
        </p>
      </div>
    );
  if (!data)
    return (
      <div className="live-loading" role="status">
        <Loader2 size={24} className="spinning" />
        개요를 불러오는 중입니다.
      </div>
    );
  const tokens = data.integrations.tokens;
  const s = data.summary,
    c = data.comparison;
  const comparisons = data.metricComparisons;
  const comparisonNote =
    c.status === "all-time"
      ? "전체 기간은 이전 기간 비교 없음"
      : c.status === "zero-baseline"
        ? "이전 동일 기간 0건 · 증감률 비교 불가"
        : "이전 동일 기간 대비";
  const line = lineOption(
    data.daily.map((d) => ({ date: d.date, value: d.questions })),
    dark,
  );
  line.series[0].smooth = 0;
  const leaderBars = barOption(
    data.leaderTop10.map((r) => ({
      name: `${r.reportRank??r.rank}. ${r.name || "(이름 없음)"} ${rankMovement(r)}`,
      team:r.team,
      value: r.questions,
    })),
    dark,
  );
  for (const bar of leaderBars.series[0].data) bar.itemStyle.color = "#726bec";

  function exportReport() {
    const url = URL.createObjectURL(
      new Blob([overviewCsv(data!)], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "openwebui-overview.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="overview-content">
      <div className="overview-meta">
        <DataFreshness data={data} unconfirmed={!!error}/>
        <button className="button" onClick={exportReport}>
          <ArrowDownToLine size={15} />
          리포트 CSV
        </button>
      </div>
      {data.dataState.organization !== "loaded" && (
        <p className="live-note">
          조직 CSV 상태: {data.dataState.organization}. 팀장 집계에는 올바른
          직급 매핑이 필요합니다.
        </p>
      )}
      <div className="overview-primary">
        <Metric
          label="활성 사용자"
          value={s.activeUsers}
          comparison={comparisons?.activeUsers}
          format={(n) => number(n) + "명"}
          note="선택 기간 질문 1건 이상"
          icon={<Activity size={18} />}
        />
        <Metric
          label="총 질문 수"
          value={s.questions}
          format={(n) => number(n) + "건"}
          prior={c.questions ?? undefined}
          comparison={comparisons?.questions}
          comparisonAvailable={c.status === "available"}
          note={comparisonNote}
          icon={<MessageSquare size={18} />}
        />
        <article className="metric overview-unavailable">
          <div className="metric-top">
            <span>총 토큰 (토큰)</span>
            <Layers3 size={18} />
          </div>
          <strong className="pending-value">
            <TokenCount value={tokens.total}/>
          </strong>
          <ComparisonBadge comparison={comparisons?.tokens}/>
          <div className="metric-note">
            {tokens.status === "ready"
              ? "LiteLLM 로그 기준"
              : "업데이트 필요"}
          </div>
        </article>
      </div>
      {c.start && (
        <p className="overview-comparison">
          비교 기간 {c.start} — {c.end} · 이전 질문 {number(c.questions!)}건
        </p>
      )}
      <div className="overview-secondary">
        <Metric
          label="전체 사용자 수"
          value={s.users}
          comparison={comparisons?.users}
          format={(n) => number(n) + "명"}
          note="OpenWebUI 명부 · 사용량 0 포함"
          icon={<Users size={17} />}
        />
        <Metric
          label="총 채팅방 수"
          value={s.chats}
          comparison={comparisons?.chats}
          format={(n) => number(n) + "개"}
          note="기간 내 질문이 발생한 채팅방"
          icon={<MessageSquare size={17} />}
        />
        <Metric
          label="파일 첨부 질문"
          value={s.attachmentQuestions}
          comparison={comparisons?.attachmentQuestions}
          format={(n) => number(n) + "건"}
          note="파일이 포함된 사용자 질문"
          icon={<Paperclip size={17} />}
        />
        {s.averageQuestionsPerChat === null ? (
          <article className="metric overview-unavailable">
            <div className="metric-top">
              평균 질문/채팅방
              <BarChart3 size={17} />
            </div>
            <strong className="pending-value">—</strong>
            <ComparisonBadge comparison={comparisons?.averageQuestionsPerChat}/>
            <div className="metric-note">질문이 발생한 채팅방 없음</div>
          </article>
        ) : (
          <Metric
            label="평균 질문/채팅방"
            value={s.averageQuestionsPerChat}
            comparison={comparisons?.averageQuestionsPerChat}
            format={(n) => n.toFixed(1) + "건"}
            note="총 질문 수 ÷ 총 채팅방 수"
            icon={<BarChart3 size={17} />}
          />
        )}
        <Metric
          label="활성 팀장"
          value={s.activeLeaders}
          comparison={comparisons?.activeLeaders}
          format={(n) => number(n) + "명"}
          note={`전체 팀장 ${number(s.leaders)}명 · 기간 내 질문 1건 이상`}
          icon={<Users size={17} />}
        />
      </div>
      {data.activity30d&&<div className="overview-activity">
        <Metric label="최근 30일간 접속자" value={data.activity30d.users} comparison={comparisons?.activity30dUsers} format={n=>number(n)+'명'} note={`${data.activity30d.start} ~ ${data.activity30d.end} · 질문 1건 이상`} icon={<Users size={18}/>}/>
        <Metric label="일일 사용자 평균" value={data.activity30d.dailyAverage} comparison={comparisons?.dailyAverage} format={n=>n.toFixed(1)+'명'} note="최근 30일 · 사용이 없는 날 포함" icon={<Activity size={18}/>}/>
      </div>}
      {data.weeklyResponses&&<Panel title="주간 메시지 추이" subtitle="모델 응답 수 기준 · 월요일~일요일 · 한국 시간">
        <div className="weekly-response-summary"><span>기간 총계 <strong>{number(data.weeklyResponses.total)}건</strong></span><span>최고 주간 <strong>{number(data.weeklyResponses.peak)}건</strong></span></div>
        <Chart height={280} dark={dark} label="주간 모델 응답 메시지 수" option={{tooltip:{trigger:'axis',renderMode:'richText',formatter:(params:any)=>{const r=data.weeklyResponses!.records[params[0].dataIndex];return `${r.start} ~ ${r.end}${r.partial?' (일부 기간)':''}\n모델 응답 ${number(r.responses)}건`;}},grid:{left:60,right:25,top:20,bottom:55},xAxis:{type:'category',boundaryGap:false,data:data.weeklyResponses.records.map(r=>r.start.slice(5)+(r.partial?'*':'')),axisLabel:{fontSize:14,color:dark?'#b0b4ce':'#70778f'}},yAxis:{type:'value',minInterval:1,axisLabel:{fontSize:14,color:dark?'#b0b4ce':'#70778f'}},series:[{type:'line',smooth:false,showSymbol:true,symbolSize:7,data:data.weeklyResponses.records.map(r=>r.responses),lineStyle:{color:'#726bec',width:3},itemStyle:{color:'#726bec'}}]}}/>
        <p className="live-note">* 조회 기간에 일부만 포함된 주 · 저장된 모델 응답 기준</p>
      </Panel>}
      <div className="overview-middle">
        <Panel
          title="일별 질문 추이"
          subtitle="선택 기간 · 전체 사용자의 일별 질문 수"
          className="overview-panel"
        >
          <div className="overview-chart-body">
            {!data.daily.length ? (
              <Empty />
            ) : dailyMode === "chart" ? (
              <Chart
                dark={dark}
                height={280}
                label="전체 사용자의 날짜별 질문 수"
                option={line}
              />
            ) : (
              <div className="overview-table-scroll">
                <table>
                  <caption className="sr-only">일별 전체 질문 수</caption>
                  <thead>
                    <tr>
                      <th>날짜 (한국 시간)</th>
                      <th>질문 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily
                      .slice((dailyPage - 1) * 30, dailyPage * 30)
                      .map((d) => (
                        <tr key={d.date}>
                          <td>{d.date}</td>
                          <td>{number(d.questions)}건</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="overview-panel-footer">
            <span>
              일별 합계 · {number(data.daily.length)}일
              {dailyMode === "table" && data.daily.length > 30 && (
                <span className="overview-day-pages">
                  <button
                    className="button"
                    disabled={dailyPage === 1}
                    onClick={() => setDailyPage((p) => p - 1)}
                  >
                    이전
                  </button>
                  {dailyPage}/{Math.ceil(data.daily.length / 30)}
                  <button
                    className="button"
                    disabled={dailyPage * 30 >= data.daily.length}
                    onClick={() => setDailyPage((p) => p + 1)}
                  >
                    다음
                  </button>
                </span>
              )}
            </span>
            <ModeToggle
              label="일별 질문 추이"
              mode={dailyMode}
              onChange={setDailyMode}
            />
          </div>
        </Panel>
        <Panel
          title="질문 카테고리 분포"
          subtitle="질문 수 기준 · 미분류 포함"
          className="overview-panel"
        >
          <div className="overview-chart-body">
            {data.integrations.categories.status === "ready" && data.integrations.categories.records
              ? <CategoryDistribution rows={data.integrations.categories.records} dark={dark} table={categoryMode === "table"}/>
              : <Pending category /> }
          </div>
          <div className="overview-panel-footer">
            <span>{data.integrations.categories.status === "ready" ? `분류 완료 ${number(data.integrations.categories.classified ?? 0)}건` : "분류 결과 대기"}</span>
            <ModeToggle
              label="질문 카테고리 분포"
              mode={categoryMode}
              onChange={setCategoryMode}
            />
          </div>
        </Panel>
      </div>
      <div className="overview-bottom">
        <Panel
          title="토큰 사용 요약"

          className="overview-panel overview-token-panel"
        >
          <div className="overview-cost">
            <CircleDollarSign size={25} />
            <div>
              <span>추정 비용 (USD)</span>
              <strong>
                {tokens.costUsd === null
                  ? "—"
                  : "$" + tokens.costUsd.toFixed(4)}
              </strong>
            </div>
            <small>
              {tokens.status === "ready"
                ? "LiteLLM 기준"
                : "업데이트 필요"}
            </small>
          </div>
          <div className="overview-token-total">
            <Layers3 size={19} />
            <span>총 토큰 (토큰)</span>
            <strong>
              <TokenCount value={tokens.total}/>
            </strong>
          </div>
          <div className="overview-token-grid">
            {["입력 토큰 (토큰)", "출력 토큰 (토큰)", "요청 수 (건)", "요청당 평균 (토큰/요청)"].map(
              (label, index) => (
                <div key={label}>
                  <span>{label}</span>
                  <strong>
                    {[
                      tokens.input,
                      tokens.output,
                      tokens.requests,
                      tokens.averagePerRequest,
                    ][index] === null
                      ? "—"
                      : number(
                          [
                            tokens.input,
                            tokens.output,
                            tokens.requests,
                            tokens.averagePerRequest,
                          ][index]!,
                        )}
                  </strong>
                </div>
              ),
            )}
          </div>
          <p className="live-note">
            {tokens.status !== "ready"
              ? "미수집 값은 실제 0과 구분하여 표시합니다."
              : tokens.missingCostRequests
                ? "비용이 누락된 요청이 있습니다. 토큰 화면에서 확인하세요."
                : ""}
          </p>
        </Panel>
        <Panel
          title="팀장 Top 10"
          subtitle="선택 기간 질문 수 기준"
          className="overview-panel"
          action={
            <button
              className="overview-link"
              onClick={() => onLeaders(leaderQuery(q, data.period))}
            >
              전체 보기
              <ArrowRight size={15} />
            </button>
          }
        >
          <RankComparison q={q} onChange={onChange} comparison={data.leaderComparison} currentStart={data.period.start}/>
          <div className="overview-chart-body">
            {!data.leaderTop10.length ? (
              <div className="overview-pending">
                <Users size={30} />
                <strong>매핑된 팀장이 없습니다</strong>
                <p>조직 정보를 확인하세요.</p>
              </div>
            ) : leaderMode === "chart" ? (
              <Chart
                height={280}
                dark={dark}
                label="팀장 Top 10 질문 수 순위, 0건 포함"
                option={leaderBars}
              />
            ) : (
              <div className="overview-table-scroll">
                <table>
                  <caption className="sr-only">팀장 질문 수 Top 10</caption>
                  <thead>
                    <tr>
                      <th>순위</th>
                      <th>이전 순위</th>
                      <th>순위 변동</th>
                      <th>사용자명</th>
                      <th>팀</th>
                      <th>질문 수</th>
                      <th>채팅방 수</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.leaderTop10.map((r) => (
                      <tr key={r.id}>
                        <td>{r.reportRank??r.rank}</td>
                        <td>{r.previousRank??"—"}</td>
                        <td><RankMovement row={r}/></td>
                        <td>{r.name || "(이름 없음)"}</td>
                        <td>{r.team}</td>
                        <td>{number(r.questions)}</td>
                        <td>{number(r.chats)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="overview-panel-footer">
            <span />
            <ModeToggle
              label="팀장 Top 10"
              mode={leaderMode}
              onChange={setLeaderMode}
            />
          </div>
        </Panel>
      </div>
    </div>
  );
}
