"""Explicit isolated browser fault fixture: synthetic identity, no network provider."""
import time
from apps.server.config import Settings
from apps.server.main import create_app


class InterruptedProvider:
    def analyze(self, context):
        time.sleep(3)  # Lets the browser exercise polling while the job is running.
        raise ConnectionError('Synthetic provider outage')


app=create_app(Settings(database='artifacts/failure-browser.sqlite3',environment='test',demo=True),
               provider=InterruptedProvider())
