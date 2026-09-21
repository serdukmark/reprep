"""Disruptions through real app routes; no graphical input or live providers."""
import asyncio,time
from concurrent.futures import ThreadPoolExecutor
from threading import Event
from unittest.mock import patch
from tests.test_workflow import env,submit,review
from apps.server.ai import LocalRules


def test_slow_model_keeps_api_responsive_and_cannot_overwrite_teacher(env):
    c,app,cfg,h=env;entered=Event();release=Event();original=LocalRules.analyze
    def slow(self,context):
        entered.set();assert release.wait(5),'test controller failed to release model'
        return original(self,context)
    sid=submit(c,h['learner']).json()['id']
    with patch.object(LocalRules,'analyze',slow),ThreadPoolExecutor(max_workers=1) as pool:
        future=pool.submit(lambda:asyncio.run(app.state.process_one()))
        try:
            assert entered.wait(2)
            for _ in range(3):
                before=time.monotonic();item=c.get('/api/assignments/demo-assignment',headers=h['learner']).json()
                assert time.monotonic()-before<2
                assert item['submission']['status']=='processing' and item['submission']['analysis'] is None
            assert review(c,h['tutor'],sid).status_code==200
        finally:release.set()
        assert future.result(timeout=3)
    final=c.get('/api/assignments/demo-assignment',headers=h['tutor']).json()['submission']
    assert final['status']=='reviewed' and final['review']['action']=='corrected'
    assert final['analysis'] is None,'late model must not overwrite human decision'


def test_lost_submit_response_duplicate_review_and_two_tabs_preserve_one_attempt(env):
    c,app,cfg,h=env
    second={'Authorization':'Bearer '+c.post('/api/auth/demo/learner').json()['token']}
    answers={'linear':'5','fraction':'0,75','reason':'Одинаковое действие'}
    assert c.put('/api/assignments/demo-assignment/draft',headers=h['learner'],json={'revision':0,'answers':answers}).status_code==200
    assert c.put('/api/assignments/demo-assignment/draft',headers=second,json={'revision':0,'answers':{'linear':'Чужая вкладка'}}).status_code==409
    # Server accepted, client lost the response: discard it, then repeat the same intent.
    assert submit(c,h['learner'],answers=answers,revision=1).status_code==200
    retry=submit(c,second,answers=answers,revision=1);sid=retry.json()['id']
    assert retry.status_code==200
    assert len(c.get('/api/assignments/demo-assignment/attempts',headers=second).json()['items'])==1
    asyncio.run(app.state.process_one())
    assert review(c,h['tutor'],sid).status_code==200
    assert review(c,h['tutor'],sid).status_code==200
    assert sum(p['total'] for p in c.get('/api/relationships/demo-link/progress',headers=second).json())==3
    assert c.get('/api/assignments/demo-assignment',headers=second).json()['submission']['answers']==answers


def test_two_guardian_and_colleague_sessions_lose_all_sensitive_routes_on_revoke(env):
    c,app,cfg,h=env
    guardians=[{'Authorization':'Bearer '+c.post('/api/auth/demo/guardian').json()['token']} for _ in range(2)]
    inv=c.post('/api/relationships/demo-link/guardians',headers=h['tutor']).json()
    assert c.post('/api/guardian/accept',headers=guardians[0],json={'token':inv['token']}).status_code==200
    wid=c.post('/api/workspaces',headers=h['tutor'],json={'title':'Доступы репетиции'}).json()['id']
    invite=c.post('/api/workspaces/'+wid+'/invite',headers=h['tutor']).json()
    assert c.post('/api/workspaces/accept',headers=h['outsider'],json={'token':invite['token']}).status_code==200
    template=c.post('/api/workspaces/'+wid+'/templates',headers=h['tutor'],json={'assignment_id':'demo-assignment'}).json()['id']
    colleagues=[h['outsider'],{'Authorization':'Bearer '+c.post('/api/auth/demo/outsider').json()['token']}]
    assert c.post('/api/guardian/invitations/'+inv['id']+'/revoke',headers=h['tutor']).status_code==200
    assert c.post('/api/workspaces/'+wid+'/members/demo-outsider/remove',headers=h['tutor']).status_code==200
    for head in guardians:
        assert c.get('/api/guardian/links',headers=head).json()==[]
        assert c.get('/api/guardian/links/demo-link',headers=head).status_code==404
        for path in ('assignments/demo-assignment','relationships/demo-link/plan'):
            assert c.get('/api/'+path,headers=head).status_code==404
        assert c.get('/api/materials',headers=head).json()==[]
        assert 'BEGIN:VEVENT' not in c.get('/api/calendar',headers=head).json()['content']
        assert c.get('/api/account/export',headers=head).json()['assignments']==[]
    for head in colleagues:
        for path in ('templates','members','invitations'):
            assert c.get('/api/workspaces/'+wid+'/'+path,headers=head).status_code==404
        assert c.post('/api/workspace-templates/'+template+'/copy',headers=head,json={'relationship_id':'demo-link','client_id':'revoked-copy-test'}).status_code==404
        assert c.get('/api/assignments/demo-assignment',headers=head).status_code==404
        assert c.get('/api/account/export',headers=head).json()['assignments']==[]
