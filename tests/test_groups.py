from tests.test_workflow import env


def test_group_scope_revision_and_idempotent_assignments(env):
    c,app,cfg,h=env
    body={'title':'Синтетическая группа','relationship_ids':['demo-link','demo-link-2']}
    assert c.post('/api/groups',headers=h['learner'],json=body).status_code==403
    assert c.post('/api/groups',headers=h['outsider'],json=body).status_code==404
    g=c.post('/api/groups',headers=h['tutor'],json=body).json()
    request={'revision':g['revision'],'client_id':'group-assignment-1','assignment_id':'demo-assignment'}
    path='/api/groups/'+g['id']+'/assign'
    result=c.post(path,headers=h['tutor'],json=request)
    assert result.status_code==200 and result.json()['count']==2
    assert c.post(path,headers=h['tutor'],json=request).json()==result.json()
    first,second=result.json()['assignment_ids']
    for aid,who,denied in [(first,'learner','learner-2'),(second,'learner-2','learner')]:
        item=c.get('/api/assignments/'+aid,headers=h[who]).json()
        assert item['status']=='published' and item['submission'] is None and 'answer' not in item['tasks'][0]
        assert c.get('/api/assignments/'+aid,headers=h[denied]).status_code==404
    assert c.get('/api/groups',headers=h['outsider']).json()==[]
    assert c.get('/api/groups',headers=h['learner']).status_code==403
    update={**body,'revision':1,'relationship_ids':['demo-link']}
    assert c.put('/api/groups/'+g['id'],headers=h['tutor'],json=update).json()['revision']==2
    assert c.post(path,headers=h['tutor'],json={**request,'client_id':'group-assignment-2'}).status_code==409
    assert c.post(path,headers=h['tutor'],json=request).json()==result.json()
    assert c.get('/api/assignments/'+second,headers=h['learner-2']).status_code==200


def test_group_lesson_each_pupil_sees_only_own_row(env):
    c,app,cfg,h=env
    g=c.post('/api/groups',headers=h['tutor'],json={'title':'Разбор задач','relationship_ids':['demo-link','demo-link-2']}).json()
    data={'revision':1,'client_id':'group-lesson-001','title':'Общее занятие','starts_at':'2026-09-26T15:00:00+03:00','duration':45}
    path='/api/groups/'+g['id']+'/lessons'
    result=c.post(path,headers=h['tutor'],json=data)
    assert result.status_code==200 and result.json()['count']==2
    assert c.post(path,headers=h['tutor'],json=data).json()==result.json()
    for who in ('learner','learner-2'):
        lessons=[x for x in c.get('/api/lessons',headers=h[who]).json() if x['title']=='Общее занятие']
        assert len(lessons)==1 and 'payment_status' not in lessons[0]
    assert c.post(path,headers=h['tutor'],json={**data,'title':'Подмена операции'}).status_code==409
    assert c.post('/api/demo/reset',headers=h['tutor']).status_code==200
