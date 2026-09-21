import asyncio
from pathlib import Path
from tests.test_workflow import env,submit,review


def test_export_is_complete_for_attempts_and_keeps_private_drafts_and_ai_hidden(env):
    c,app,cfg,h=env
    secret='Личный неотправленный текст'
    c.put('/api/assignments/demo-assignment/draft',headers=h['learner'],json={'revision':0,'answers':{'linear':secret}})
    teacher=c.get('/api/account/export',headers=h['tutor'])
    assert teacher.status_code==200 and 'attachment' in teacher.headers['content-disposition']
    assert secret not in teacher.text and 'drafts' not in teacher.json()
    student=c.get('/api/account/export',headers=h['learner']).json()
    assert student['drafts'][0]['answers']['linear']==secret
    sid=submit(c,h['learner'],revision=1).json()['id'];asyncio.run(app.state.process_one())
    before=c.get('/api/account/export',headers=h['learner']).json()
    assert before['submissions'][0]['analysis'] is None
    assert c.get('/api/account/export',headers=h['tutor']).json()['submissions'][0]['analysis']
    review(c,h['tutor'],sid,action='returned')
    nextid=submit(c,h['learner']).json()['id']
    result=c.get('/api/account/export',headers=h['learner']).json()
    assert {item['id'] for item in result['submissions']}=={sid,nextid}
    assert all('answer' not in task for a in result['assignments'] for task in a['tasks'])
    outsider=c.get('/api/account/export',headers=h['outsider']).json()
    assert outsider['assignments']==[] and outsider['submissions']==[]
    assert 'token_hash' not in str(result) and 'lease_until' not in str(result)
    assert c.get('/api/account/export').status_code==401
    assert not list((Path(cfg.database).parent/'exports').iterdir())


def test_deletion_request_is_explicit_idempotent_and_cancellable(env):
    c,app,cfg,h=env
    assert c.get('/api/account/deletion',headers=h['learner']).json()['request'] is None
    assert c.post('/api/account/deletion',headers=h['learner'],json={'confirm_alias':'Другое имя'}).status_code==422
    body={'confirm_alias':'Саша • демо'}
    request=c.post('/api/account/deletion',headers=h['learner'],json=body)
    assert request.status_code==201
    assert c.post('/api/account/deletion',headers=h['learner'],json=body).json()==request.json()
    assert c.get('/api/account/deletion',headers=h['tutor']).json()['request'] is None
    assert c.get('/api/assignments/demo-assignment',headers=h['learner']).status_code==200
    assert c.post('/api/account/deletion/cancel',headers=h['learner']).status_code==200
    assert c.get('/api/account/deletion',headers=h['learner']).json()['request']['status']=='cancelled'


def test_operator_erasure_requires_policy_and_preserves_other_learners(env,monkeypatch,tmp_path):
    from apps.server import account_erasure
    from apps.server.db import connect,one
    from apps.server.backup import verify
    import pytest
    c,app,cfg,h=env
    c.post('/api/groups',headers=h['tutor'],json={'title':'Пара учеников','relationship_ids':['demo-link','demo-link-2'],'revision':0})
    c.put('/api/relationships/demo-link/skill-graph',headers=h['tutor'],json={'revision':0,'skills':['Математика'],'edges':[]})
    sid=submit(c,h['learner']).json()['id'];asyncio.run(app.state.process_one());review(c,h['tutor'],sid)
    c.post('/api/account/deletion',headers=h['learner'],json={'confirm_alias':'Саша • демо'})
    backup=tmp_path/'before-erasure.sqlite3'
    monkeypatch.setattr(account_erasure.Settings,'load',lambda:cfg)
    monkeypatch.setattr('sys.argv',['erase','--user-id','demo-learner','--apply','--confirm-user-id','demo-learner','--backup',str(backup)])
    monkeypatch.setenv('ACCOUNT_DELETION_APPROVED','false')
    with pytest.raises(SystemExit) as exc:account_erasure.main()
    assert exc.value.code==2 and not backup.exists()
    assert c.get('/api/me',headers=h['learner']).status_code==200
    monkeypatch.setenv('ACCOUNT_DELETION_APPROVED','true');account_erasure.main();verify(backup)
    assert c.get('/api/me',headers=h['learner']).status_code==401
    assert c.get('/api/assignments/demo-assignment',headers=h['tutor']).status_code==404
    assert c.get('/api/assignments/demo-assignment-2',headers=h['learner-2']).status_code==200
    assert c.get('/api/groups',headers=h['tutor']).json()[0]['relationship_ids']==['demo-link-2']
    with connect(cfg.database) as db:
        assert one(db,'SELECT id FROM submissions WHERE id=?',(sid,)) is None
        assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
    assert backup.stat().st_mode & 0o777==0o600


def test_erasing_tutor_keeps_colleagues_independent_template_copy(env):
    from apps.server.account_erasure import erase_requested
    from apps.server.db import connect,one
    c,app,cfg,h=env
    wid=c.post('/api/workspaces',headers=h['tutor'],json={'title':'Шаблоны'}).json()['id']
    code=c.post('/api/workspaces/'+wid+'/invite',headers=h['tutor']).json()['token']
    c.post('/api/workspaces/accept',headers=h['outsider'],json={'token':code})
    tid=c.post('/api/workspaces/'+wid+'/templates',headers=h['tutor'],json={'assignment_id':'demo-assignment'}).json()['id']
    with connect(cfg.database) as db:db.execute("INSERT INTO relationships VALUES('colleague-keep','demo-outsider','demo-learner-2','Math')")
    aid=c.post('/api/workspace-templates/'+tid+'/copy',headers=h['outsider'],json={'relationship_id':'colleague-keep','client_id':'keep-this-copy'}).json()['id']
    c.post('/api/account/deletion',headers=h['tutor'],json={'confirm_alias':'Алекс • демо'})
    with connect(cfg.database) as db:erase_requested(db,'demo-tutor')
    assert c.get('/api/me',headers=h['tutor']).status_code==401
    assert c.get('/api/assignments/'+aid,headers=h['outsider']).status_code==200
    assert c.get('/api/workspaces',headers=h['outsider']).json()==[]
    with connect(cfg.database) as db:assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
