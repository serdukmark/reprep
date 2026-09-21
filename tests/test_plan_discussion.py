from tests.test_workflow import env


def test_plan_revision_scope_and_draft_links(env):
    c,app,cfg,h=env
    path='/api/relationships/demo-link/plan'
    assert c.get(path,headers=h['learner']).json()['revision']==0
    draft=c.post('/api/assignments/demo-assignment/duplicate',headers=h['tutor']).json()['id']
    body={'revision':0,'goal':'Освоить уравнения','level':'Базовый','steps':[{'title':'Равносильность','skill':'Уравнения','assignment_id':draft}]}
    assert c.put(path,headers=h['learner'],json=body).status_code==403
    assert c.put(path,headers=h['outsider'],json=body).status_code==404
    r=c.put(path,headers=h['tutor'],json=body)
    assert r.status_code==200 and r.json()['revision']==1
    assert c.put(path,headers=h['tutor'],json=body).status_code==409
    assert c.get(path,headers=h['learner']).json()['steps'][0]['assignment_id']==''
    c.post('/api/assignments/'+draft+'/publish',headers=h['tutor'])
    assert c.get(path,headers=h['learner']).json()['steps'][0]['assignment_id']==draft
    assert c.get(path,headers=h['learner-2']).status_code==404
    body['revision']=1;body['steps'][0]['assignment_id']='demo-assignment-2'
    assert c.put(path,headers=h['tutor'],json=body).status_code==404
    assert c.get(path,headers=h['tutor']).json()['revision']==1


def test_discussion_private_idempotent_and_not_in_drafts(env):
    c,app,cfg,h=env
    path='/api/assignments/demo-assignment/messages'
    body={'client_id':'synthetic-message-1','text':'Объясните переход ко второй строке.'}
    first=c.post(path,headers=h['learner'],json=body)
    assert first.status_code==201
    assert c.post(path,headers=h['learner'],json=body).json()==first.json()
    assert c.post(path,headers=h['learner'],json={**body,'text':'Изменённое сообщение'}).status_code==409
    assert c.get(path,headers=h['tutor']).json()[0]['text']==body['text']
    assert len(c.get(path,headers=h['learner']).json())==1
    for who in ('outsider','learner-2'):
        assert c.get(path,headers=h[who]).status_code==404
        assert c.post(path,headers=h[who],json=body).status_code==404
    draft=c.post('/api/assignments/demo-assignment/duplicate',headers=h['tutor']).json()['id']
    assert c.post('/api/assignments/'+draft+'/messages',headers=h['tutor'],json=body).status_code==409
    for i in range(9): assert c.post(path,headers=h['learner'],json={**body,'client_id':f'synthetic-message-{i+2}'}).status_code==201
    assert c.post(path,headers=h['learner'],json={**body,'client_id':'synthetic-message-last'}).status_code==429
    assert c.post(path,headers=h['learner'],json=body).status_code==201
    assert c.post('/api/demo/reset',headers=h['tutor']).status_code==200
