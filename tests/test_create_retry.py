from concurrent.futures import ThreadPoolExecutor
from tests.test_workflow import env
from apps.server.db import connect, one

BODY = {'client_id':'synthetic-request-123', 'relationship_id':'', 'title':'Сохранение с потерей ответа', 'tasks':[{'id':'q','type':'numeric','prompt':'2+2?','answer':'4','skill':'Сложение'}]}

def test_create_retry_is_idempotent_scoped_and_conflicts_are_explicit(env):
    c,app,cfg,h=env
    first=c.post('/api/assignments',headers=h['outsider'],json=BODY)
    again=c.post('/api/assignments',headers=h['outsider'],json=BODY)
    assert first.status_code==again.status_code==201
    assert first.json()['id']==again.json()['id']
    assert 'client_id' not in first.json()
    assert len(c.get('/api/assignments',headers=h['outsider']).json())==1
    changed=c.post('/api/assignments',headers=h['outsider'],json={**BODY,'title':'Изменённое содержание'})
    assert changed.status_code==409 and changed.json()['error']['code']=='CREATE_CONFLICT'
    other=c.post('/api/assignments',headers=h['tutor'],json=BODY)
    assert other.status_code==201 and other.json()['id']!=first.json()['id']
    assert c.get('/api/assignments/'+first.json()['id'],headers=h['tutor']).status_code==404
    with connect(cfg.database) as db:
        assert one(db,"SELECT count(*) n FROM audit WHERE resource_id=? AND event='assignment_draft_created'",(first.json()['id'],))['n']==1
    # Old callers without a request key still create distinct intentional works.
    legacy={k:v for k,v in BODY.items() if k!='client_id'}
    assert c.post('/api/assignments',headers=h['outsider'],json=legacy).json()['id']!=c.post('/api/assignments',headers=h['outsider'],json=legacy).json()['id']


def test_concurrent_retry_and_retry_after_publication(env):
    c,app,cfg,h=env
    body={**BODY,'relationship_id':'demo-link'}
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _:c.post('/api/assignments',headers=h['tutor'],json=body),range(2)))
    assert all(r.status_code==201 for r in results)
    assert len({r.json()['id'] for r in results})==1
    aid=results[0].json()['id']
    assert c.post('/api/assignments/'+aid+'/publish',headers=h['tutor']).status_code==200
    replay=c.post('/api/assignments',headers=h['tutor'],json=body)
    assert replay.status_code==201 and replay.json()['id']==aid and replay.json()['status']=='published'
    assert c.post('/api/assignments/'+aid+'/publish',headers=h['tutor']).status_code==200
