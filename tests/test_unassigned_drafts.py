import sqlite3
from tests.test_workflow import env
from apps.server.db import initialize,connect,one,SCHEMA
from apps.server.service import seed


def test_new_tutor_can_save_draft_before_first_learner(env):
    c,app,cfg,h=env
    body={'relationship_id':'','title':'Первый черновик','tasks':[{'id':'q','type':'numeric','prompt':'2+2?','answer':'4','skill':'Сложение'}]}
    r=c.post('/api/assignments',headers=h['outsider'],json=body)
    assert r.status_code==201
    aid=r.json()['id']
    assert c.get('/api/assignments/'+aid,headers=h['outsider']).status_code==200
    listed=c.get('/api/assignments',headers=h['outsider']).json()
    assert any(a['id']==aid and a['relationship_id']=='' and a['learner_alias']=='Ученик не выбран' for a in listed)
    for role in ('tutor','learner','learner-2'):
        assert c.get('/api/assignments/'+aid,headers=h[role]).status_code==404
        assert all(a['id']!=aid for a in c.get('/api/assignments',headers=h[role]).json())
    assert c.post('/api/assignments/'+aid+'/publish',headers=h['outsider']).status_code==422
    assert c.post('/api/assignments',headers=h['learner'],json=body).status_code==403
    assert c.put('/api/assignments/'+aid+'?revision=1',headers=h['outsider'],json={**body,'relationship_id':'demo-link'}).status_code==404
    code=c.post('/api/invitations',headers=h['outsider'],json={'subject':'Алгебра'}).json()['token']
    assert c.post('/api/invitations/accept',headers=h['learner'],json={'token':code}).status_code==200
    link=c.get('/api/relationships',headers=h['outsider']).json()[0]['id']
    assert c.put('/api/assignments/'+aid+'?revision=1',headers=h['outsider'],json={**body,'relationship_id':link}).status_code==200
    assert c.post('/api/assignments/'+aid+'/publish',headers=h['outsider']).status_code==200
    assert c.get('/api/assignments/'+aid,headers=h['learner']).status_code==200


def test_v10_migration_preserves_work_and_foreign_keys(tmp_path):
    path=str(tmp_path/'v10.sqlite')
    old=SCHEMA.replace('relationship_id TEXT REFERENCES relationships(id), status','relationship_id TEXT NOT NULL REFERENCES relationships(id), status')
    with sqlite3.connect(path) as c:
        c.executescript(old)
        c.execute('INSERT OR IGNORE INTO schema_migrations VALUES(5)')
        seed(c)
        c.execute("INSERT INTO drafts VALUES('demo-assignment','demo-learner',1,'{\"linear\":\"4\"}')")
    initialize(path);initialize(path)
    with connect(path) as c:
        assert one(c,"SELECT answers FROM drafts WHERE assignment_id='demo-assignment'")['answers']=='{"linear":"4"}'
        assert one(c,"SELECT count(*) n FROM assignments")['n']==2
        assert c.execute('PRAGMA foreign_key_check').fetchall()==[]
        assert next(r for r in c.execute('PRAGMA table_info(assignments)') if r['name']=='relationship_id')['notnull']==0
        assert one(c,'SELECT version FROM schema_migrations WHERE version=11')
