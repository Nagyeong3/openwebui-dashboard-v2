"""Report metrics from stored messages. Activity means questions, not login events."""
from collections import Counter, defaultdict
from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo
SEOUL=ZoneInfo('Asia/Seoul')

def _date(s):
    value=date.fromisoformat(s)
    if value.isoformat()!=s: raise ValueError('Dates must use YYYY-MM-DD')
    return value

def leader_comparison(rows,messages,start,end,compare_start=None,compare_end=None):
    if bool(compare_start)!=bool(compare_end): raise ValueError('비교 시작일과 종료일을 함께 선택하세요.')
    if not start or not end:
        return {'start':None,'end':None,'status':'all-time','sameLength':False}
    a,b=_date(start),_date(end)
    span=(b-a).days+1
    x,y=(_date(compare_start),_date(compare_end)) if compare_start else (a-timedelta(days=span),a-timedelta(days=1))
    if x>y or y>=a or (y-x).days>3659: raise ValueError('비교 기간은 현재 기간 이전의 올바른 날짜로 선택하세요.')
    lo=datetime.combine(x,time.min,SEOUL).timestamp();hi=datetime.combine(y+timedelta(days=1),time.min,SEOUL).timestamp()
    leaders=[r for r in rows if '팀장' in r['position']]
    ids={r['id'] for r in leaders}
    prior=Counter(m['user_id'] for m in messages if m['role']=='user' and m['user_id'] in ids and lo<=m['created_at']<hi)
    current={r['id']:r['questions'] for r in leaders}
    def ranks(counts):
        ordered=sorted(counts.values(),reverse=True)
        return {uid:ordered.index(count)+1 for uid,count in counts.items()}
    old=ranks({uid:prior[uid] for uid in ids});now=ranks(current)
    # No evidence of history reaching the baseline: avoid a fabricated increase.
    known=any(m['created_at']<hi for m in messages)
    for r in leaders:
        uid=r['id'];r['reportRank']=now[uid];r['previousQuestions']=prior[uid] if known else None
        r['previousRank']=old[uid] if known else None
        r['rankChange']=old[uid]-now[uid] if known else None
        r['rankChangeStatus']='compared' if known else 'unavailable'
        r['questionChange']=current[uid]-prior[uid] if known else None
    return {'start':x.isoformat(),'end':y.isoformat(),'status':'available' if known else 'no-history','sameLength':(y-x).days+1==span}

def overview_activity(users,messages,start,end,latest):
    ids={u['id'] for u in users}
    last=_date(end) if end else datetime.fromisoformat(latest).astimezone(SEOUL).date()
    first=last-timedelta(days=29)
    active=defaultdict(set)
    for m in messages:
        if m['role']=='user' and m['user_id'] in ids:
            d=datetime.fromtimestamp(m['created_at'],SEOUL).date()
            if first<=d<=last: active[d].add(m['user_id'])
    activity={'start':first.isoformat(),'end':last.isoformat(),'days':30,'users':len(set().union(*active.values())) if active else 0,'dailyAverage':sum(map(len,active.values()))/30,'basis':'user-questions'}
    dated=[(datetime.fromtimestamp(m['created_at'],SEOUL).date(),m) for m in messages if m['user_id'] in ids]
    a=_date(start) if start else min((d for d,m in dated),default=last)
    b=_date(end) if end else max((d for d,m in dated),default=last)
    counts=Counter(d-timedelta(days=d.weekday()) for d,m in dated if a<=d<=b and m['role']=='assistant')
    rows=[];week=a-timedelta(days=a.weekday())
    while week<=b:
        lo=max(week,a);hi=min(week+timedelta(days=6),b)
        rows.append({'start':lo.isoformat(),'end':hi.isoformat(),'responses':counts[week],'partial':lo!=week or hi!=week+timedelta(days=6)})
        week+=timedelta(days=7)
    weekly={'records':rows,'total':sum(r['responses'] for r in rows),'peak':max((r['responses'] for r in rows),default=0),'basis':'stored-assistant-messages','weekStartsOn':'Monday'}
    return activity,weekly


def metric_change(current, previous, start, end, status='available'):
    """Do not turn missing history or an undefined zero baseline into a percent."""
    if status == 'available':
        if current is None or previous is None:
            status = 'no-value'
        elif previous == 0 and current != 0:
            status = 'zero-baseline'
    percent = (round((current-previous)/previous*100, 1) if previous else 0.0) if status == 'available' else None
    return {'current': current, 'previous': previous, 'start': start, 'end': end,
            'status': status, 'changePercent': percent}
