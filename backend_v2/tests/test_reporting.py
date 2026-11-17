import unittest
from datetime import datetime
from zoneinfo import ZoneInfo
from backend_v2.reporting import leader_comparison,overview_activity,metric_change
SEOUL=ZoneInfo('Asia/Seoul')
def m(uid,day,role='user'):
    return {'user_id':uid,'created_at':datetime.fromisoformat(day+'T12:00:00').replace(tzinfo=SEOUL).timestamp(),'role':role}
def rows():return [{'id':'a','position':'팀장','questions':3},{'id':'b','position':'팀장','questions':3},{'id':'c','position':'팀장','questions':0}]
class ReportingTests(unittest.TestCase):
    def test_ties_and_same_cohort(self):
        r=rows();info=leader_comparison(r,[m('a','2026-11-01'),m('c','2026-11-01'),m('c','2026-11-01')],'2026-11-08','2026-11-14')
        self.assertEqual(info['start'],'2026-11-01');self.assertEqual([x['reportRank'] for x in r],[1,1,3])
        self.assertEqual(r[0]['rankChange'],1);self.assertEqual(r[1]['rankChange'],2);self.assertEqual(r[1]['rankChangeStatus'],'compared');self.assertEqual(r[2]['rankChange'],-2)
    def test_percent_zero_and_missing_history(self):
        self.assertEqual(metric_change(20,10,'2026-01-01','2026-01-07')['changePercent'],100)
        self.assertEqual(metric_change(0,10,None,None)['changePercent'],-100)
        self.assertEqual(metric_change(0,0,None,None)['changePercent'],0)
        self.assertEqual(metric_change(1,0,None,None)['status'],'zero-baseline')
        self.assertIsNone(metric_change(10,None,None,None,'no-history')['changePercent'])
    def test_unknown_history_not_zero(self):
        r=rows();info=leader_comparison(r,[m('a','2026-11-10')],'2026-11-08','2026-11-14')
        self.assertEqual(info['status'],'no-history');self.assertIsNone(r[0]['rankChange']);self.assertIsNone(r[0]['previousQuestions'])
    def test_custom_period_and_validation(self):
        r=rows();info=leader_comparison(r,[m('a','2026-10-01')],'2026-11-08','2026-11-14','2026-10-01','2026-10-31')
        self.assertFalse(info['sameLength'])
        for x,y in [('2026-11-08','2026-11-09'),('2026-10-01',None),('2026-10-02','2026-10-01')]:
            with self.assertRaises(ValueError):leader_comparison(rows(),[],'2026-11-08','2026-11-14',x,y)
    def test_all_time_no_invented_comparison(self):
        self.assertEqual(leader_comparison(rows(),[],None,None)['status'],'all-time')
    def test_activity_unique_users_and_zero_days(self):
        users=[{'id':'a'},{'id':'b'}];messages=[m('a','2026-11-01'),m('a','2026-11-01'),m('a','2026-11-02'),m('b','2026-11-02'),m('outsider','2026-11-02'),m('b','2026-10-01'),m('b','2026-11-03','assistant')]
        activity,_=overview_activity(users,messages,'2026-11-01','2026-11-16','2026-11-16T00:00:00+09:00')
        self.assertEqual(activity['users'],2);self.assertEqual(activity['dailyAverage'],0.1);self.assertEqual(activity['start'],'2026-10-18')
    def test_weekly_assistant_only_and_partial_edges(self):
        users=[{'id':'a'}];messages=[m('a','2026-11-01','assistant'),m('a','2026-11-02','assistant'),m('a','2026-11-02'),m('a','2026-11-16','assistant'),m('a','2026-11-17','assistant')]
        _,weekly=overview_activity(users,messages,'2026-11-01','2026-11-16','2026-11-16T00:00:00+09:00')
        self.assertEqual(weekly['total'],3);self.assertEqual(weekly['peak'],1);self.assertEqual(len(weekly['records']),4)
        self.assertTrue(weekly['records'][0]['partial']);self.assertTrue(weekly['records'][-1]['partial']);self.assertEqual(weekly['records'][2]['responses'],0)
    def test_korean_midnight_boundary(self):
        msg={'user_id':'a','role':'assistant','created_at':datetime.fromisoformat('2026-11-01T15:00:00+00:00').timestamp()}
        _,w=overview_activity([{'id':'a'}],[msg],'2026-11-02','2026-11-08','2026-11-08T00:00:00+09:00')
        self.assertEqual(w['total'],1);self.assertFalse(w['records'][0]['partial'])

class ReportingApiTests(unittest.TestCase):
    def test_http_contract_custom_compare_and_export(self):
        from tempfile import TemporaryDirectory
        from pathlib import Path
        from backend_v2.settings import Settings
        from backend_v2.cache import Cache
        from backend_v2.sync import Synchronizer
        from backend_v2.app import create_app
        from backend_v2.tests.test_backend import FakeClient,message
        from fastapi.testclient import TestClient
        with TemporaryDirectory() as tmp:
            root=Path(tmp);org=root/'users.csv';org.write_text('실,팀,직급,이름,사용자 ID\n본부,가팀,팀장,검증가,u1\n본부,나팀,팀장,검증나,u2\n본부,다팀,팀장,검증다,u3\n')
            s=Settings(page_size=2,base_url='http://example.invalid',api_token='test',cache_path=root/'cache.sqlite3',token_cache_path=root/'tokens.sqlite3',category_cache_path=root/'category.sqlite3',org_csv=org)
            c=Cache(s.cache_path);client=FakeClient();client.items=[]
            for uid,prior,now in [('u1',2,5),('u2',5,2),('u3',0,0)]:
                for tag,count,day in [('old',prior,'2026-11-02'),('new',now,'2026-11-10')]:
                    for i in range(count):
                        epoch=m(uid,day)['created_at'];client.items.extend([message(uid+tag+str(i),uid,created=epoch),message(uid+tag+'a'+str(i),uid,created=epoch+1,role='assistant')])
            Synchronizer(s,c,client).run('full')
            with TestClient(create_app(s,c)) as web:
                query='start=2026-11-09&end=2026-11-15&compareStart=2026-11-01&compareEnd=2026-11-07'
                response=web.get('/api/dashboard/v2/overview?'+query);self.assertEqual(response.status_code,200)
                p=response.json();self.assertEqual(p['weeklyResponses']['total'],7);self.assertEqual(p['leaderTop10'][0]['rankChange'],1);self.assertEqual(p['activity30d']['users'],2)
                metrics=p['metricComparisons'];self.assertEqual(len(metrics),10)
                self.assertEqual(metrics['questions']['changePercent'],0)
                self.assertEqual(metrics['activeLeaders']['previous'],2)
                self.assertEqual(metrics['users']['status'],'no-roster-history')
                self.assertIsNone(metrics['users']['changePercent'])
                self.assertEqual(metrics['questions']['start'],'2026-11-02')
                self.assertEqual(metrics['activity30dUsers']['end'],'2026-10-16')
                from backend_v2.token_store import TokenStore
                store=TokenStore(s.token_cache_path)
                with store.connect() as db:
                    db.executemany('INSERT INTO token_meta(key,value) VALUES(?,?)', [('last_success','2026-11-16T00:00:00+09:00'),('coverage_start',str(m('u1','2026-11-01')['created_at']))])
                    db.executemany('INSERT INTO token_logs VALUES(?,?,?,?,?,?,?,?,?,?)', [
                        ('before',m('u1','2026-11-02')['created_at'],'test',100,0,100,0,'u1','',''),
                        ('now',m('u1','2026-11-10')['created_at'],'test',150,0,150,0,'u1','','')])
                tokens=web.get('/api/dashboard/v2/overview?'+query).json()['metricComparisons']['tokens']
                self.assertEqual(tokens['changePercent'],50)
                with store.connect() as db:
                    db.execute("UPDATE token_meta SET value=? WHERE key='coverage_start'",(str(m('u1','2026-11-05')['created_at']),))
                tokens=web.get('/api/dashboard/v2/overview?'+query).json()['metricComparisons']['tokens']
                self.assertEqual(tokens['status'],'no-history');self.assertIsNone(tokens['changePercent'])
                response=web.get('/api/dashboard/v2/users?view=leader&pageSize=1&'+query);self.assertEqual(response.status_code,200)
                self.assertEqual(len(response.json()['leaderRanking']),3);self.assertEqual(response.json()['detail']['records'][0]['previousRank'],2)
                export=web.get('/api/dashboard/v2/users/export?view=leader&'+query);self.assertEqual(export.status_code,200);self.assertIn('순위 증감',export.text)
                self.assertEqual(web.get('/api/dashboard/v2/overview?start=2026-11-09&end=2026-11-15&compareStart=2026-11-10&compareEnd=2026-11-11').status_code,422)
