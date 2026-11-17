"""Overview built from one published cache snapshot; no upstream calls on page load."""

from datetime import datetime, time, timedelta

from .analytics import SEOUL, user_usage


def overview(cache, settings, *, start=None, end=None, range_value="30d", compare_start=None, compare_end=None):
    snapshot = cache.read()
    state = cache.status()

    class Snapshot:
        def read(self):
            return snapshot

        def status(self):
            return state

    payload = user_usage(
        Snapshot(),
        settings,
        start=start,
        end=end,
        range_value=range_value,
        paginate=False,
        compare_start=compare_start, compare_end=compare_end,
    )
    records = payload["detail"]["records"]
    leaders = [r for r in records if "팀장" in r["position"]]
    for rank, row in enumerate(leaders, 1):
        # Do not mutate the person rank in the full user result.
        leaders[rank - 1] = {**row, "rank": rank}
    summary = {
        **payload["summary"],
        "averageQuestionsPerChat": (
            round(payload["summary"]["questions"] / payload["summary"]["chats"], 1)
            if payload["summary"]["chats"]
            else None
        ),
        "leaders": len(leaders),
        "activeLeaders": sum(r["questions"] > 0 for r in leaders),
    }
    comparison = {
        "status": "all-time",
        "start": None,
        "end": None,
        "questions": None,
        "changePercent": None,
    }
    a, b = payload["period"]["start"], payload["period"]["end"]
    if a and b:
        current_start = datetime.fromisoformat(a).date()
        current_end = datetime.fromisoformat(b).date()
        span = (current_end - current_start).days + 1
        previous_end = current_start - timedelta(days=1)
        previous_start = current_start - timedelta(days=span)
        lo = datetime.combine(previous_start, time.min, SEOUL).timestamp()
        hi = datetime.combine(current_start, time.min, SEOUL).timestamp()
        ids = {r["id"] for r in records}
        prior = sum(
            m["role"] == "user" and m["user_id"] in ids and lo <= m["created_at"] < hi
            for m in snapshot[1]
        )
        comparison = {
            "status": "available" if prior else "zero-baseline",
            "start": previous_start.isoformat(),
            "end": previous_end.isoformat(),
            "questions": prior,
            "changePercent": (
                round((summary["questions"] - prior) / prior * 100, 1)
                if prior
                else None
            ),
        }
    # Full history has no comparison period. Fill missing dates for the chart/table
    # when the available history fits the same supported custom-range bound.
    daily = payload["daily"]
    if not a and daily:
        first = datetime.fromisoformat(daily[0]["date"]).date()
        last = datetime.fromisoformat(daily[-1]["date"]).date()
        if (last - first).days <= 3659:
            values = {d["date"]: d["questions"] for d in daily}
            daily = [
                {
                    "date": (first + timedelta(days=i)).isoformat(),
                    "questions": values.get((first + timedelta(days=i)).isoformat(), 0),
                }
                for i in range((last - first).days + 1)
            ]
    tokens = {
        "status": "not-connected",
        "source": "litellm",
        "total": None,
        "input": None,
        "output": None,
        "requests": None,
        "averagePerRequest": None,
        "costUsd": None,
    }
    previous_tokens = None
    token_comparison_status = 'not-connected'
    if settings.litellm_url or settings.token_cache_path.exists():
        try:
            from .token_analytics import token_usage

            result = token_usage(
                Snapshot(),
                settings,
                start=a,
                end=b,
                range_value="all" if not a else range_value,
            )
            tokens = {
                **result["summary"],
                "status": "ready",
                "source": "litellm",
                "updatedAt": result["updatedAt"],
                "stale": result["dataState"]["stale"],
            }
            if a and b:
                from .token_store import TokenStore
                _, token_meta = TokenStore(settings.token_cache_path).read(settings)
                previous_result = token_usage(Snapshot(), settings, start=comparison['start'], end=comparison['end'])
                previous_tokens = previous_result['summary']['total']
                coverage = float(token_meta.get('coverage_start', 'inf'))
                token_comparison_status = 'available' if coverage <= lo else 'no-history'
        except Exception:
            if tokens['status'] != 'ready':
                tokens["status"] = "not-synced"
            token_comparison_status = 'not-synced'
    categories = {"status":"not-connected","source":"embedding-classifier","records":None,"classified":None}
    if settings.category_csv or settings.category_cache_path.exists():
        try:
            from .category_analytics import category_usage
            result = category_usage(Snapshot(),settings,start=a,end=b,range_value="all" if not a else range_value)
            categories = {"status":"ready","source":"litellm-classifier","records":result["distribution"],
                          "classified":result["summary"]["classified"],"questions":result["summary"]["questions"],
                          "pending":result["summary"]["pending"]}
        except Exception:
            categories = {"status":"not-synced","source":"litellm-classifier","records":None,"classified":None}
    from .reporting import overview_activity, metric_change
    activity,weekly=overview_activity(snapshot[0],snapshot[1],a,b,payload["updatedAt"])
    keys = ('activeUsers', 'questions', 'chats', 'attachmentQuestions', 'averageQuestionsPerChat', 'activeLeaders')
    metrics = {key: metric_change(summary[key], None, None, None, 'all-time') for key in keys}
    if a and b:
        previous = user_usage(Snapshot(), settings, start=comparison['start'], end=comparison['end'], paginate=False)
        old_summary = previous['summary']
        old_summary['averageQuestionsPerChat'] = old_summary['questions']/old_summary['chats'] if old_summary['chats'] else None
        old_summary['activeLeaders'] = sum('팀장' in r['position'] and r['questions'] > 0 for r in previous['detail']['records'])
        known = any(m['created_at'] < hi for m in snapshot[1])
        for key in keys:
            current = summary[key]
            if key == 'averageQuestionsPerChat':
                current = summary['questions']/summary['chats'] if summary['chats'] else None
            metrics[key] = metric_change(current, old_summary[key] if known else None, comparison['start'], comparison['end'], 'available' if known else 'no-history')
    metrics['users'] = metric_change(summary['users'], None, comparison['start'], comparison['end'], 'no-roster-history' if a else 'all-time')
    metrics['tokens'] = metric_change(tokens['total'], previous_tokens, comparison['start'], comparison['end'], token_comparison_status if a else 'all-time')
    activity_start = datetime.fromisoformat(activity['start']).date()
    old_activity_end = (activity_start - timedelta(days=1)).isoformat()
    old_activity_start = (activity_start - timedelta(days=30)).isoformat()
    old_activity, _ = overview_activity(snapshot[0], snapshot[1], old_activity_start, old_activity_end, payload['updatedAt'])
    activity_known = any(m['created_at'] < datetime.combine(activity_start, time.min, SEOUL).timestamp() for m in snapshot[1])
    for key, value_key in [('activity30dUsers', 'users'), ('dailyAverage', 'dailyAverage')]:
        metrics[key] = metric_change(activity[value_key], old_activity[value_key] if activity_known else None, old_activity_start, old_activity_end, 'available' if activity_known else 'no-history')
    return {
        "metricComparisons": metrics,
        "activity30d": activity,
        "weeklyResponses": weekly,
        "leaderComparison": payload["leaderComparison"],
        "schemaVersion": 1,
        "source": payload["source"],
        "period": payload["period"],
        "updatedAt": payload["updatedAt"],
        "dataState": payload["dataState"],
        "summary": summary,
        "comparison": comparison,
        "daily": daily,
        "leaderTop10": leaders[:10],
        "integrations": {
            "tokens": tokens,
            "categories": categories,
        },
    }
