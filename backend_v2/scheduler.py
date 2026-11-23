"""Server-side weekly updates sharing durable operations state with manual runs."""
from datetime import datetime, timedelta
import logging
from threading import Event, Thread
from zoneinfo import ZoneInfo

from .cache import BusyError
from .operations import OperationsStore, prepare, execute

SEOUL = ZoneInfo('Asia/Seoul')
logger = logging.getLogger(__name__)


def weekly_slot(now):
    if now.tzinfo is None:
        raise ValueError('A timezone-aware clock is required')
    local = now.astimezone(SEOUL)
    monday = (local - timedelta(days=local.weekday())).replace(hour=8, minute=30, second=0, microsecond=0)
    return monday if local >= monday else monday-timedelta(days=7)


def schedule_status(settings, store, now=None):
    now = now or datetime.now(SEOUL)
    slot = weekly_slot(now)
    with store.connect() as db:
        prior = db.execute('SELECT id,status FROM operation_runs WHERE scheduled_for=?', (slot.isoformat(),)).fetchone()
    pending = settings.auto_update_enabled and not prior and slot <= now < slot+timedelta(days=1)
    configured = bool(settings.base_url and settings.api_token)
    return {'enabled': settings.auto_update_enabled, 'timezone': 'Asia/Seoul',
            'weekday': 0, 'time': '08:30', 'kind': 'quick',
            'nextRunAt': (slot if pending else slot+timedelta(days=7)).isoformat() if settings.auto_update_enabled else None,
            'pending': bool(pending), 'configured': configured,
            'lastRunId': prior['id'] if prior else None}


class WeeklyScheduler:
    def __init__(self, settings, cache, *, clock=None, launch=None):
        self.settings, self.cache = settings, cache
        self.clock = clock or (lambda: datetime.now(SEOUL))
        self.launch = launch or self._launch
        self.stopped = Event()
        self.thread = None

    def _launch(self, store, run):
        Thread(target=execute, args=(self.settings, self.cache, store, run), daemon=True,
               name='scheduled-operation-worker').start()

    def tick(self):
        if not self.settings.auto_update_enabled or not (self.settings.base_url and self.settings.api_token):
            return None
        now = self.clock()
        slot = weekly_slot(now)
        # Catch up within 24 hours after downtime/busy collectors, never replay old weeks.
        if not slot <= now < slot+timedelta(days=1):
            return None
        store = OperationsStore(self.settings.operations_path)
        with store.connect() as db:
            if db.execute('SELECT 1 FROM operation_runs WHERE scheduled_for=?', (slot.isoformat(),)).fetchone():
                return None
        try:
            run = prepare(self.settings, self.cache, store, 'quick', scheduled_for=slot.isoformat())
        except BusyError:
            return None  # Existing manual/paused/source jobs retain priority; retry on next tick.
        if run:
            try:
                self.launch(store, run)
            except Exception:
                store.finish(run, 'failed', '자동 업데이트를 시작하지 못했습니다. 다시 실행해 주세요.')
                logger.error('Scheduled worker launch failed')
        return run

    def start(self):
        if self.thread is not None or not self.settings.auto_update_enabled:
            return
        def loop():
            while not self.stopped.is_set():
                try:
                    self.tick()
                except Exception:
                    # Do not expose source URLs/credentials in the UI or logs.
                    logger.error('Automatic update scheduling failed; it will retry on the next check')
                self.stopped.wait(15)
        self.thread = Thread(target=loop, daemon=True, name='weekly-update-scheduler')
        self.thread.start()

    def stop(self):
        self.stopped.set()
        if self.thread is not None:
            self.thread.join(timeout=2)
