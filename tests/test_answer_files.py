import asyncio
from tests.test_workflow import env,review


def payload(content='  3x + 7 = 22\n3x = 15\nx = 5\n'):
    return {'revision':0,'answers':{'fraction':'0,75','reason':'Вычитаем одинаковое число.'},
            'attachments':{'linear':{'file_name':'solution.txt','content':content}}}


def test_attachment_draft_submit_replay_return_and_immutable_history(env):
    c,app,cfg,h=env
    url='/api/assignments/demo-assignment'
    body=payload()
    saved=c.put(url+'/draft',headers=h['learner'],json=body)
    assert saved.status_code==200
    assert c.get(url,headers=h['learner']).json()['draft']['attachments']==body['attachments']
    assert c.get(url,headers=h['tutor']).json()['draft']['attachments']=={}
    body['revision']=1
    sid=c.post(url+'/submit',headers=h['learner'],json=body).json()['id']
    assert c.post(url+'/submit',headers=h['learner'],json=body).json()['id']==sid
    changed=payload('different');changed['revision']=1
    assert c.post(url+'/submit',headers=h['learner'],json=changed).status_code==409
    assert c.put(url+'/draft',headers=h['learner'],json=changed).status_code==409
    asyncio.run(app.state.process_one())
    assert review(c,h['tutor'],sid,action='returned').status_code==200
    changed['revision']=0
    nextid=c.post(url+'/submit',headers=h['learner'],json=changed).json()['id']
    assert nextid!=sid
    for role in ('tutor','learner'):
        original=c.get('/api/submissions/'+sid,headers=h[role]).json()
        assert original['attachments']==body['attachments']
    for role in ('outsider','learner-2'):
        assert c.get('/api/submissions/'+sid,headers=h[role]).status_code==404


def test_attachment_validation_and_revision_conflicts(env):
    c,app,cfg,h=env;url='/api/assignments/demo-assignment'
    for filename,content in [('bad.pdf','text'),('../bad.txt','text'),('ok.txt',''),('ok.txt','\0'),('ok.txt','я'*30001)]:
        body=payload(content);body['attachments']['linear']['file_name']=filename
        assert c.put(url+'/draft',headers=h['learner'],json=body).status_code==422
    body=payload();body['answers']['linear']='5';body['attachments']['other']=body['attachments'].pop('linear')
    assert c.post(url+'/submit',headers=h['learner'],json=body).status_code==422
    assert c.put(url+'/draft',headers=h['tutor'],json=payload()).status_code==403
    assert c.put(url+'/draft',headers=h['learner'],json=payload()).status_code==200
    assert c.put(url+'/draft',headers=h['learner'],json=payload('new')).status_code==409
    assert c.get(url,headers=h['learner']).json()['draft']['attachments']==payload()['attachments']


def test_ai_context_includes_file_but_stored_answer_stays_original(env):
    c,app,cfg,h=env
    sid=c.post('/api/assignments/demo-assignment/submit',headers=h['learner'],json=payload()).json()['id']
    from apps.server.ai import LocalRules
    seen=[];original=LocalRules.analyze
    def capture(self,context):
        seen.append(context);return original(self,context)
    from unittest.mock import patch
    with patch.object(LocalRules,'analyze',capture):asyncio.run(app.state.process_one())
    assert payload()['attachments']['linear']['content'] in seen[0]['answers']['linear']
    stored=c.get('/api/submissions/'+sid,headers=h['tutor']).json()
    assert 'linear' not in stored['answers'] and stored['attachments']==payload()['attachments']


def test_large_file_is_preserved_and_routes_to_teacher(env):
    c,app,cfg,h=env
    body=payload('x'*60000)
    sid=c.post('/api/assignments/demo-assignment/submit',headers=h['learner'],json=body).json()['id']
    asyncio.run(app.state.process_one())
    stored=c.get('/api/submissions/'+sid,headers=h['tutor']).json()
    assert stored['status']=='awaiting_review'
    assert stored['analysis']['failure_reason']=='context_too_large'
    assert stored['attachments']==body['attachments']
