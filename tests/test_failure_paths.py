"""Real API/queue/adapter boundary with synthetic HTTP faults; no paid calls."""
import asyncio
from concurrent.futures import ThreadPoolExecutor
import json
import threading
from unittest.mock import patch

import httpx
import pytest
from fastapi.testclient import TestClient
from apps.server.ai import OpenRouterAdapter, LocalRules
from apps.server.config import Settings
from apps.server.main import create_app


def login(c, role):
    return {'Authorization': 'Bearer '+c.post('/api/auth/demo/'+role).json()['token']}


def make_assignment(c, tutor, relationship='demo-link', long=False):
    body={'relationship_id':relationship,'title':'Проверка устойчивости','tasks':[
        {'id':str(i),'type':'short_text','prompt':'Объясни сохранение равенства',
         'answer':'Одинаковая операция','skill':'Уравнения'} for i in range(20 if long else 1)]}
    r=c.post('/api/assignments',headers=tutor,json=body)
    assert r.status_code==201
    aid=r.json()['id']
    assert c.post('/api/assignments/'+aid+'/publish',headers=tutor).status_code==200
    return aid


def send(c, learner, aid, answers):
    r=c.post('/api/assignments/'+aid+'/submit',headers=learner,json={'answers':answers,'revision':0})
    assert r.status_code==200
    return r.json()['id']


def manual(c, tutor, learner, aid, sid, answers):
    s=c.get('/api/assignments/'+aid,headers=tutor).json()['submission']
    assert s['status']=='awaiting_review'
    assert s['answers']==answers
    assert s['analysis']['requires_tutor_review'] is True
    assert s['analysis']['tasks']==[]
    # A failure is neither an automatic grade nor confirmable empty feedback.
    assert c.post('/api/submissions/'+sid+'/review',headers=tutor,json={'action':'confirmed'}).status_code==422
    assert c.get('/api/relationships/demo-link/progress',headers=learner).json()==[]
    assert c.get('/api/submissions/'+sid,headers=learner).json()['analysis'] is None
    feedback=[{'task_id':tid,'correctness':'unknown','feedback':'Разберём вместе на занятии.'} for tid in answers]
    r=c.post('/api/submissions/'+sid+'/review',headers=tutor,json={'action':'corrected','tasks':feedback,'note':'Проверено вручную'})
    assert r.status_code==200
    final=c.get('/api/submissions/'+sid,headers=learner).json()
    assert final['status']=='reviewed' and final['answers']==answers
    assert final['review']['tasks']==feedback
    return s['analysis']


CASES=['connect','http_503','http_429','read_disconnect','read_timeout','empty','garbage','schema','envelope','context_limit']


@pytest.mark.parametrize('fault',CASES)
def test_fault_keeps_original_and_reaches_manual_review(tmp_path, fault, caplog):
    cfg=Settings(database=str(tmp_path/'fault.sqlite'),environment='test',demo=True)
    engine=OpenRouterAdapter('synthetic-test-credential','test-model')
    app=create_app(cfg,provider=engine,run_worker=False)
    calls=[]
    def upstream(request):
        calls.append(request)
        if fault=='connect': raise httpx.ConnectError('synthetic-private-marker',request=request)
        if fault=='read_disconnect': raise httpx.ReadError('synthetic-private-marker',request=request)
        if fault=='read_timeout': raise httpx.ReadTimeout('synthetic-private-marker',request=request)
        if fault.startswith('http_'): return httpx.Response(int(fault[5:]),text='synthetic-private-marker')
        if fault=='envelope': return httpx.Response(200,json=[])
        content={'empty':'','garbage':'<html>bad</html>','schema':json.dumps({'tasks':[]})}.get(fault,'{}')
        return httpx.Response(200,json={'choices':[{'finish_reason':'stop','message':{'content':content}}]})
    client_factory=httpx.Client
    with TestClient(app) as c:
        tutor,learner=login(c,'tutor'),login(c,'learner')
        aid=make_assignment(c,tutor,long=fault=='context_limit')
        answers={str(i):'я'*2000 for i in range(20)} if fault=='context_limit' else {'0':'Мой исходный ответ'}
        sid=send(c,learner,aid,answers)
        with patch('apps.server.ai.httpx.Client',side_effect=lambda **kw:client_factory(transport=httpx.MockTransport(upstream),**kw)):
            assert asyncio.run(app.state.process_one()) is True
        result=manual(c,tutor,learner,aid,sid,answers)
        expected='provider_unavailable' if fault in ('connect','http_503','http_429','read_disconnect','read_timeout') else 'output_invalid'
        assert result['assessment_status']==expected
        if fault=='context_limit':
            assert calls==[] and result['failure_reason']=='context_too_large'
        else: assert len(calls)==1
        assert 'synthetic-private-marker' not in caplog.text
        assert 'synthetic-test-credential' not in caplog.text


def test_two_simultaneous_learners_keep_separate_jobs(tmp_path):
    cfg=Settings(database=str(tmp_path/'parallel.sqlite'),environment='test',demo=True)
    calls=[]
    lock=threading.Lock()
    class Provider:
        def analyze(self,context):
            with lock: calls.append(context['answers'])
            if context['answers']['0']=='Первый': raise httpx.ReadError('disconnect')
            return LocalRules().analyze(context)
    app=create_app(cfg,provider=Provider(),run_worker=False)
    with TestClient(app) as c:
        tutor=login(c,'tutor'); learners=[login(c,r) for r in ('learner','learner-2')]
        aids=[make_assignment(c,tutor,r) for r in ('demo-link','demo-link-2')]
        answers=[{'0':'Первый'},{'0':'Одинаковая операция'}]
        gate=threading.Barrier(2)
        def concurrent_submit(i):
            gate.wait(timeout=5)
            return send(c,learners[i],aids[i],answers[i])
        with ThreadPoolExecutor(max_workers=2) as pool: sids=list(pool.map(concurrent_submit,range(2)))
        async def run_jobs():
            return await asyncio.gather(app.state.process_one(),app.state.process_one())
        assert asyncio.run(run_jobs())==[True,True]
        assert len(calls)==2 and all(calls.count(a)==1 for a in answers)
        assert asyncio.run(app.state.process_one()) is False
        for i in range(2):
            s=c.get('/api/submissions/'+sids[i],headers=tutor).json()
            assert s['status']=='awaiting_review' and s['answers']==answers[i]
            assert c.get('/api/submissions/'+sids[i],headers=learners[1-i]).status_code==404
        manual(c,tutor,learners[0],aids[0],sids[0],answers[0])
        assert c.get('/api/relationships/demo-link-2/progress',headers=learners[1]).json()==[]
        analysis=c.get('/api/submissions/'+sids[1],headers=tutor).json()['analysis']
        reviewed=[{'task_id':t['task_id'],'correctness':t['correctness'],'feedback':t['feedback_for_learner']} for t in analysis['tasks']]
        assert c.post('/api/submissions/'+sids[1]+'/review',headers=tutor,json={'action':'confirmed','tasks':reviewed}).status_code==200
        progress=c.get('/api/relationships/demo-link-2/progress',headers=learners[1]).json()
        assert len(progress)==1 and progress[0]['correct']==1


def test_unsent_draft_is_private_until_submission(tmp_path):
    cfg=Settings(database=str(tmp_path/'private.sqlite'),environment='test',demo=True)
    with TestClient(create_app(cfg,run_worker=False)) as c:
        tutor,learner=login(c,'tutor'),login(c,'learner')
        aid=make_assignment(c,tutor)
        answers={'0':'Ещё не готов делиться этим ответом'}
        assert c.put('/api/assignments/'+aid+'/draft',headers=learner,json={'revision':0,'answers':answers}).status_code==200
        assert c.get('/api/assignments/'+aid,headers=learner).json()['draft']['answers']==answers
        view=c.get('/api/assignments/'+aid,headers=tutor).json()
        assert view['draft']=={'answers':{},'revision':0,'attachments':{}} and view['submission'] is None
        r=c.post('/api/assignments/'+aid+'/submit',headers=learner,json={'revision':1,'answers':answers})
        assert r.status_code==200
        assert c.get('/api/assignments/'+aid,headers=tutor).json()['submission']['answers']==answers
