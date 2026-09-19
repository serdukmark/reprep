"""Idempotently add synthetic fixtures. Never deletes existing data."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from apps.server.config import Settings
from apps.server.db import initialize,connect
from apps.server.service import seed

if __name__=='__main__':
    cfg=Settings.load()
    if not cfg.demo or cfg.environment not in ('development','demo','test'):
        raise SystemExit('Synthetic seeding disabled in this environment')
    initialize(cfg.database)
    with connect(cfg.database) as db:seed(db)
    print('Synthetic demo fixtures present. Existing data preserved.')
