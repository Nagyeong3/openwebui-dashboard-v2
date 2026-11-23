import unittest
from dataclasses import replace
from datetime import datetime
from unittest.mock import patch
from concurrent.futures import ThreadPoolExecutor
from fastapi.testclient import TestClient
from backend_v2.scheduler import WeeklyScheduler, weekly_slot, schedule_status
from backend_v2.operations import OperationsStore, prepare, execute
from backend_v2.tests import test_operations as fixtures
from backend_v2.app import create_app


class SchedulerTests(unittest.TestCase):
    setUp = fixtures.OperationsTests.setUp
    tearDown = fixtures.OperationsTests.tearDown

    def scheduler(self, at='2026-11-23T08:30:00+09:00', launch=None):
        self.s=replace(self.s,auto_update_enabled=True)
        return WeeklyScheduler(self.s,self.cache,clock=lambda:datetime.fromisoformat(at),launch=launch or (lambda db,run:None))

    def test_monday_kst_and_before_due(self):
        self.assertIsNone(self.scheduler('2026-11-23T08:29:59+09:00').tick())
        at=datetime.fromisoformat('2026-11-22T23:30:00+00:00')
        self.assertEqual(weekly_slot(at).isoformat(),'2026-11-23T08:30:00+09:00')
        run=self.scheduler().tick()
        self.assertTrue(run)
        self.assertEqual(self.db.read(run)[0]['origin'],'scheduled')
        self.assertEqual(self.db.read(run)[0]['scheduled_for'],'2026-11-23T08:30:00+09:00')

    def test_restart_and_parallel_ticks_do_not_duplicate(self):
        a,b=self.scheduler(),self.scheduler()
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(lambda s:s.tick(),[a,b]))
        self.assertEqual(sum(bool(x) for x in results),1)
        self.db.finish(next(x for x in results if x),'success')
        self.assertIsNone(self.scheduler().tick())
        self.assertEqual(len(OperationsStore(self.s.operations_path).read()),1)

    def test_busy_defers_and_downtime_grace(self):
        manual=prepare(self.s,self.cache,self.db)
        self.assertIsNone(self.scheduler().tick())
        self.db.finish(manual,'cancelled')
        self.assertTrue(self.scheduler('2026-11-24T08:29:59+09:00').tick())
        self.assertIsNone(self.scheduler('2026-11-24T08:30:00+09:00').tick())
        info=schedule_status(self.s,self.db,datetime.fromisoformat('2026-11-24T10:00:00+09:00'))
        self.assertEqual(info['nextRunAt'],'2026-11-30T08:30:00+09:00')

    def test_disabled_or_unconfigured_never_launches(self):
        s=self.scheduler();s.settings=replace(self.s,auto_update_enabled=False)
        self.assertIsNone(s.tick())
        s.settings=replace(self.s,api_token='')
        self.assertIsNone(s.tick())
        self.assertEqual(self.db.read(),[])

    def test_scheduled_job_is_visible_in_existing_poll_and_can_finish(self):
        run=self.scheduler().tick()
        with patch('backend_v2.scheduler.WeeklyScheduler.start'), TestClient(create_app(self.s,self.cache)) as web:
            state=web.get('/api/dashboard/v2/operations/status').json()
            self.assertEqual(state['activeRunId'],run)
            self.assertEqual(state['runs'][0]['origin'],'scheduled')
            self.assertEqual(state['runs'][0]['status'],'running')
            self.assertEqual(state['schedule']['time'],'08:30')
            execute(self.s,self.cache,self.db,run,owui_client=self.client,spend_client=self.spend,classifier=self.model)
            state=web.get('/api/dashboard/v2/operations/status').json()
            self.assertIsNone(state['activeRunId'])
            self.assertEqual(state['runs'][0]['status'],'success')
        self.assertIsNone(self.scheduler().tick())

    def test_lifespan_starts_and_stops_scheduler(self):
        with patch('backend_v2.scheduler.WeeklyScheduler.start') as start, patch('backend_v2.scheduler.WeeklyScheduler.stop') as stop:
            with TestClient(create_app(self.s,self.cache)):
                start.assert_called_once()
                stop.assert_not_called()
            stop.assert_called_once()

    def test_launch_failure_is_recorded_and_not_replayed(self):
        def fail(store,run):raise RuntimeError('worker failed')
        s=self.scheduler(launch=fail)
        with self.assertLogs('backend_v2.scheduler',level='ERROR'):
            run=s.tick()
        self.assertEqual(self.db.read(run)[0]['status'],'failed')
        self.assertIsNone(self.scheduler().tick())

    def test_environment_enables_by_default_and_can_disable(self):
        import os
        from backend_v2.settings import Settings
        path=self.root/'test.env';path.write_text('DASHBOARD_AUTO_UPDATE_ENABLED=false\n')
        with patch.dict(os.environ,{},clear=True):
            self.assertFalse(Settings.from_env(path).auto_update_enabled)
            path.write_text('')
            self.assertTrue(Settings.from_env(path).auto_update_enabled)
