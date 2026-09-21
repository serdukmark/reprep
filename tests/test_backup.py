import pytest
from tests.test_workflow import env
from apps.server.backup import snapshot,verify
from apps.server.db import initialize,connect,one
from apps.server.service import seed


def test_backup_restore_preserves_data_and_refuses_overwrite(tmp_path):
    source=tmp_path/'source.sqlite';copy=tmp_path/'backup.sqlite';restored=tmp_path/'restore.sqlite'
    initialize(str(source))
    with connect(str(source)) as db:seed(db)
    snapshot(source,copy)
    # Later source changes must not alter the snapshot.
    with connect(str(source)) as db:db.execute("UPDATE users SET alias='Changed after backup' WHERE id='demo-tutor'")
    snapshot(copy,restored);verify(restored)
    with connect(str(restored)) as db:assert one(db,"SELECT alias FROM users WHERE id='demo-tutor'")['alias']=='Алекс • демо'
    before=source.read_bytes()
    with pytest.raises(FileExistsError):snapshot(copy,source)
    assert source.read_bytes()==before
    assert copy.stat().st_mode & 0o777 == 0o600


def test_readiness_reports_database_failure_without_exception_details(env):
    c,app,cfg,h=env
    assert c.get('/api/ready').json()['ready'] is True
    from unittest.mock import patch
    with patch('apps.server.main.connect',side_effect=OSError('private database location')):
        result=c.get('/api/ready')
        assert result.status_code==503 and result.json()['ready'] is False
        assert 'private database location' not in result.text
