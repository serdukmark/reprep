import asyncio
import hashlib
import hmac
import json
import time
from urllib.parse import urlencode
import pytest
from fastapi.testclient import TestClient
from apps.server.main import create_app
from apps.server.config import Settings
from apps.server.db import connect, one
from apps.server.auth import verify_max
from apps.server.ai import LocalRules, context_for, validate_analysis


@pytest.fixture
def env(tmp_path):
    settings=Settings(database=str(tmp_path/'app.sqlite'),environment='test',demo=True)
    app=create_app(settings,run_worker=False)
    with TestClient(app) as c:
        def login(who):
            r=c.post('/api/auth/demo/'+who)
            assert r.status_code==200,r.text
            return {'Authorization':'Bearer '+r.json()['token']}
        yield c,app,settings,{k:login(k) for k in ('tutor','learner','learner-2','outsider')}


def submit(c,h,id_='demo-assignment',answers=None,revision=0):
    return c.post('/api/assignments/'+id_+'/submit',headers=h,json={'answers':answers or {'linear':'4','fraction':'0,75','reason':'Одинаковое вычитание сохраняет равенство.'},'revision':revision})


def review(c,h,id_,action='corrected',correctness='correct'):
    return c.post('/api/submissions/'+id_+'/review',headers=h,json={'action':action,'tasks':[
        {'task_id':x,'correctness':correctness,'feedback':'Проверено. Продолжайте с новым заданием.'} for x in ('linear','fraction','reason')
    ] if action in ('corrected','confirmed') else [],'note':'Проверьте вычисления.'})


def test_core_flow_and_immutable_original(env):
    c,app,cfg,h=env
    original=c.get('/api/assignments/demo-assignment',headers=h['tutor']).json()
    body={k:original[k] for k in ('relationship_id','title','instructions','due_at','feedback_policy','tasks')}
    body['title']='Новая работа полного цикла'
    r=c.post('/api/assignments',headers=h['tutor'],json=body)
    assert r.status_code==201,r.text
    id_=r.json()['id']
    assert c.get('/api/assignments/'+id_,headers=h['learner']).status_code==404
    assert c.post('/api/assignments/'+id_+'/publish',headers=h['tutor']).status_code==200
    assert c.put('/api/assignments/'+id_+'?revision=1',headers=h['tutor'],json=body).status_code==409
    s=submit(c,h['learner'],id_)
    assert s.status_code==200,s.text
    sid=s.json()['id']
    asyncio.run(app.state.process_one())
    assert c.get('/api/relationships/demo-link/progress',headers=h['tutor']).json()==[]
    before=c.get('/api/assignments/'+id_,headers=h['tutor']).json()['submission']
    assert before['analysis']['engine']=='local_rules_v1'
    r=review(c,h['tutor'],sid)
    assert r.status_code==200,r.text
    assert review(c,h['tutor'],sid).json()['id']==r.json()['id']
    after=c.get('/api/assignments/'+id_,headers=h['learner']).json()['submission']
    assert after['answers']==before['answers']
    assert after['analysis'] is None
    assert after['review']['action']=='corrected'
    p=c.get('/api/relationships/demo-link/progress',headers=h['learner']).json()
    assert len(p)==3 and sum(x['total'] for x in p)==3


def test_cross_tutor_and_learner_isolation(env):
    c,app,cfg,h=env
    for who in ('outsider','learner-2'):
        assert c.get('/api/assignments/demo-assignment',headers=h[who]).status_code==404
        assert c.get('/api/relationships/demo-link/progress',headers=h[who]).status_code==404
        assert submit(c,h[who]).status_code in (403,404)
    assert c.get('/api/assignments',headers=h['outsider']).json()==[]
    assert c.post('/api/assignments/demo-assignment/publish',headers=h['learner']).status_code==403
    assert c.post('/api/auth/demo/not-a-user').status_code==404
    assert c.get('/api/me',headers={'Authorization':'Bearer demo-tutor'}).status_code==401


def test_learner_contract_never_contains_keys_or_rubrics(env):
    c,app,cfg,h=env
    r=c.get('/api/assignments/demo-assignment',headers=h['learner'])
    for t in r.json()['tasks']:
        assert not {'answer','rubric','hint'} & t.keys()
    sid=submit(c,h['learner']).json()['id']
    asyncio.run(app.state.process_one())
    view=c.get('/api/assignments/demo-assignment',headers=h['learner']).json()
    assert view['submission']['analysis'] is None
    assert 'summary_for_tutor' not in json.dumps(view)


def test_draft_conflict_and_repeat_submission(env):
    c,app,cfg,h=env
    answer={'linear':'4'}
    r=c.put('/api/assignments/demo-assignment/draft',headers=h['learner'],json={'revision':0,'answers':answer})
    assert r.json()['revision']==1
    r=c.put('/api/assignments/demo-assignment/draft',headers=h['learner'],json={'revision':0,'answers':{'linear':'9'}})
    assert r.status_code==409
    assert c.get('/api/assignments/demo-assignment',headers=h['learner']).json()['draft']['answers']==answer
    assert submit(c,h['learner']).status_code==409
    first=submit(c,h['learner'],revision=1)
    repeated=submit(c,h['learner'],revision=1)
    assert first.json()['id']==repeated.json()['id']
    assert submit(c,h['learner'],answers={'linear':'999','fraction':'0,75','reason':'x'},revision=1).status_code==409
    assert c.put('/api/assignments/demo-assignment/draft',headers=h['learner'],json={'revision':1,'answers':answer}).status_code==409


def test_return_creates_new_attempt_preserves_old(env):
    c,app,cfg,h=env
    sid=submit(c,h['learner']).json()['id']
    assert review(c,h['tutor'],sid,'returned').status_code==200
    newer=submit(c,h['learner'],answers={'linear':'5','fraction':'0,75','reason':'Сохраняется равенство.'})
    assert newer.status_code==200
    assert newer.json()['id']!=sid
    with connect(cfg.database) as db:
        assert one(db,'SELECT answers FROM submissions WHERE id=?',(sid,))['answers'].find('"4"')>=0
    assert c.get('/api/relationships/demo-link/progress',headers=h['tutor']).json()==[]


@pytest.mark.parametrize('invalid',[False,True])
def test_ai_failure_keeps_submission_manual_review_works(tmp_path,invalid):
    class Bad:
        def analyze(self,context):
            if invalid:return {'bad':'schema'}
            raise TimeoutError()
    cfg=Settings(database=str(tmp_path/'failure.sqlite'),environment='test',demo=True)
    app=create_app(cfg,provider=Bad(),run_worker=False)
    with TestClient(app) as c:
        h={x:{'Authorization':'Bearer '+c.post('/api/auth/demo/'+x).json()['token']} for x in ('tutor','learner')}
        sid=submit(c,h['learner']).json()['id']
        asyncio.run(app.state.process_one())
        s=c.get('/api/assignments/demo-assignment',headers=h['tutor']).json()['submission']
        assert s['answers']['linear']=='4'
        assert s['analysis']['assessment_status']==('output_invalid' if invalid else 'provider_unavailable')
        assert review(c,h['tutor'],sid).status_code==200


def test_invite_expiry_revocation_and_single_use(env):
    c,app,cfg,h=env
    def new():
        return c.post('/api/invitations',headers=h['tutor'],json={'subject':'Алгебра'}).json()
    inv=new()
    assert c.post('/api/invitations/accept',headers=h['learner-2'],json={'token':inv['token']}).status_code==200
    assert c.post('/api/invitations/accept',headers=h['learner'],json={'token':inv['token']}).status_code==410
    inv=new()
    c.post('/api/invitations/'+inv['id']+'/revoke',headers=h['tutor'])
    assert c.post('/api/invitations/accept',headers=h['learner'],json={'token':inv['token']}).status_code==410
    inv=new()
    with connect(cfg.database) as db: db.execute('UPDATE invitations SET expires=0 WHERE id=?',(inv['id'],))
    assert c.post('/api/invitations/accept',headers=h['learner'],json={'token':inv['token']}).status_code==410


def test_max_signature_unicode_duplicate_tamper_expiry():
    token='synthetic-test-token'
    values={'auth_date':str(int(time.time())),'user':json.dumps({'id':17,'first_name':'Саша'},ensure_ascii=False)}
    secret=hmac.digest(b'WebAppData',token.encode(),'sha256')
    sig=hmac.new(secret,'\n'.join(f'{k}={v}' for k,v in sorted(values.items())).encode(),hashlib.sha256).hexdigest()
    data=urlencode({**values,'hash':sig})
    assert verify_max(data,token)=='17'
    for altered in (data+'&auth_date=1',data.replace('17','18'),data.replace(sig,'0'*64)):
        with pytest.raises(ValueError):verify_max(altered,token)
    with pytest.raises(ValueError):verify_max(data,token,now=time.time()+400)


def test_demo_disabled_and_production_guard(tmp_path):
    with pytest.raises(RuntimeError):create_app(Settings(demo=True,environment='production'))
    with TestClient(create_app(Settings(database=str(tmp_path/'clean.sqlite')),run_worker=False)) as c:
        assert c.post('/api/auth/demo/tutor').status_code==404


def test_demo_reset_and_public_private_boundary(env):
    c,app,cfg,h=env
    submit(c,h['learner'])
    with connect(cfg.database) as db:
        db.execute("INSERT INTO users(id,role,alias) VALUES('real-user','tutor','Private')")
    assert c.post('/api/demo/reset',headers=h['learner']).status_code==403
    reset=c.post('/api/demo/reset',headers=h['tutor'])
    assert reset.status_code==200,reset.text
    assert c.get('/api/me',headers=h['learner']).status_code==401
    with connect(cfg.database) as db:
        assert one(db,"SELECT id FROM users WHERE id='real-user'")
        assert one(db,'SELECT COUNT(*) AS n FROM submissions')['n']==0


def test_unknown_tasks_and_incomplete_answers(env):
    c,app,cfg,h=env
    assert submit(c,h['learner'],answers={'fake':'x'}).status_code==422
    assert submit(c,h['learner'],answers={'linear':'5'}).status_code==422
    assert c.post('/api/reports',headers=h['outsider'],json={'context_id':'demo-assignment','category':'bug','text':'x'}).status_code==404
    assert c.post('/api/logout',headers={**h['tutor'],'Origin':'https://evil.test'}).status_code==403


def test_context_is_bounded_and_identifiers_validated():
    assignment={'tasks':[{'id':'x','skill':'Алгебра','type':'numeric','answer':'5','hint':''}]}
    ctx=context_for(assignment,{'x':'5'},[{'skill':'Другое','correctness':'incorrect','name':'secret'}]+[{'skill':'Алгебра','correctness':'correct','name':'secret'}]*20)
    assert len(ctx['confirmed_history'])==12
    assert 'secret' not in json.dumps(ctx)
    result=LocalRules().analyze(ctx).model_dump()
    result['tasks'][0]['skill']='Чужой навык'
    with pytest.raises(ValueError):validate_analysis(result,ctx)
