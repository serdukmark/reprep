import asyncio
import sqlite3
import time
from tests.test_workflow import env,submit,review
from apps.server.db import connect,one,initialize,SCHEMA


def guardian_headers(c):
    r=c.post('/api/auth/demo/guardian');assert r.status_code==200
    return {'Authorization':'Bearer '+r.json()['token']}


def invitation(c,h):
    r=c.post('/api/relationships/demo-link/guardians',headers=h['tutor'])
    assert r.status_code==201
    return r.json()


def test_guardian_sees_only_confirmed_summary_and_revoke_is_immediate(env):
    c,app,cfg,h=env;g=guardian_headers(c);invite=invitation(c,h)
    assert c.get('/api/guardian/links',headers=g).json()==[]
    assert c.get('/api/guardian/links/demo-link',headers=g).status_code==404
    assert c.post('/api/guardian/accept',headers=g,json={'token':invite['token']}).status_code==200
    assert c.post('/api/guardian/accept',headers=g,json={'token':invite['token']}).status_code==200
    from apps.server.auth import token_hash
    with connect(cfg.database) as db:
        db.execute("INSERT INTO users(id,role,alias,demo) VALUES('another-guardian','guardian','Other synthetic adult',1)")
        db.execute('INSERT INTO sessions VALUES(?,?,?)',(token_hash('synthetic-guardian-session'),'another-guardian',time.time()+3600))
    other={'Authorization':'Bearer synthetic-guardian-session'}
    assert c.post('/api/guardian/accept',headers=other,json={'token':invite['token']}).status_code==409
    assert c.get('/api/guardian/links/demo-link',headers=other).status_code==404
    links=c.get('/api/guardian/links',headers=g).json();assert len(links)==1 and links[0]['id']=='demo-link'
    c.post('/api/lessons',headers=h['tutor'],json={'relationship_id':'demo-link','title':'Урок синтетический','starts_at':'2026-09-25T10:00:00Z','payment_status':'unpaid'})
    sid=submit(c,h['learner']).json()['id'];asyncio.run(app.state.process_one())
    before=c.get('/api/guardian/links/demo-link',headers=g).json()
    assert before['progress']==[]
    assert review(c,h['tutor'],sid).status_code==200
    result=c.get('/api/guardian/links/demo-link',headers=g).json()
    assert len(result['progress'])==3 and len(result['lessons'])>=1
    for item in result['progress']:assert set(item)=={'skill','correct','total','latest'}
    for item in result['lessons']:assert set(item)=={'id','title','starts_at','duration','status'}
    for path in ('/api/assignments/demo-assignment','/api/submissions/'+sid,'/api/relationships/demo-link/progress','/api/relationships/demo-link/plan'):
        assert c.get(path,headers=g).status_code==404
    assert c.post('/api/assignments/demo-assignment/submit',headers=g,json={'revision':0,'answers':{}}).status_code==403
    assert c.post('/api/guardian/invitations/'+invite['id']+'/revoke',headers=h['outsider']).status_code==404
    assert c.post('/api/guardian/invitations/'+invite['id']+'/revoke',headers=h['tutor']).status_code==200
    assert c.get('/api/guardian/links',headers=g).json()==[]
    assert c.get('/api/guardian/links/demo-link',headers=g).status_code==404
    assert c.post('/api/guardian/accept',headers=g,json={'token':invite['token']}).status_code==404


def test_guardian_invitation_roles_expiry_ownership_and_real_data_gate(env):
    c,app,cfg,h=env;g=guardian_headers(c);invite=invitation(c,h)
    for role in ('tutor','learner'):
        assert c.post('/api/guardian/accept',headers=h[role],json={'token':invite['token']}).status_code==403
    assert c.post('/api/relationships/demo-link/guardians',headers=h['outsider']).status_code==404
    assert c.post('/api/relationships/demo-link/guardians',headers=h['learner']).status_code==403
    with connect(cfg.database) as db:db.execute('UPDATE guardian_access SET expires=? WHERE id=?',(time.time()-1,invite['id']))
    assert c.post('/api/guardian/accept',headers=g,json={'token':invite['token']}).status_code==404
    second=invitation(c,h)
    with connect(cfg.database) as db:db.execute("UPDATE users SET demo=0 WHERE id='demo-guardian'")
    assert c.post('/api/guardian/accept',headers=g,json={'token':second['token']}).status_code==403
    cfg.guardian_data_approved=True
    assert c.post('/api/guardian/accept',headers=g,json={'token':second['token']}).status_code==404


def test_old_database_migrates_roles_without_losing_relationships_sessions_or_constraints(tmp_path):
    path=str(tmp_path/'old.sqlite')
    with sqlite3.connect(path) as db:
        db.executescript(SCHEMA.replace("'tutor','learner','guardian'","'tutor','learner'"))
        db.execute("INSERT INTO users VALUES('t','max-t','tutor','Tutor',0)")
        db.execute("INSERT INTO users VALUES('l','max-l','learner','Learner',0)")
        db.execute("INSERT INTO relationships VALUES('r','t','l','Math')")
        db.execute("INSERT INTO sessions VALUES('hash','t',9999999999)")
    initialize(path);initialize(path)
    with connect(path) as db:
        assert one(db,"SELECT role FROM users WHERE id='t'")['role']=='tutor'
        assert one(db,"SELECT tutor_id FROM relationships WHERE id='r'")['tutor_id']=='t'
        assert one(db,"SELECT user_id FROM sessions WHERE token_hash='hash'")['user_id']=='t'
        db.execute("INSERT INTO users(id,role,alias) VALUES('g','guardian','Guardian')")
        assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
        assert one(db,'SELECT count(*) n FROM schema_migrations WHERE version=5')['n']==1
        import pytest
        with pytest.raises(sqlite3.IntegrityError):db.execute("INSERT INTO users(id,role,alias) VALUES('admin','admin','No')")
