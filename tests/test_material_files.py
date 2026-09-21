import asyncio
from tests.test_workflow import env,submit


def test_txt_authorization_scope_and_explicit_ai_permission(env):
    c,app,cfg,h=env
    def upload(**fields):
        return c.post('/api/materials',headers=h['tutor'],json={'relationship_id':'demo-link','title':'Конспект','file_name':'lesson.txt','content':'Разрешённое объяснение','assignment_id':'demo-assignment',**fields})
    denied=upload(content='PRIVATE MATERIAL',ai_allowed=False).json()['id']
    allowed=upload(ai_allowed=True).json()['id']
    assert c.get('/api/materials/'+allowed+'/file',headers=h['learner']).json()['content']=='Разрешённое объяснение'
    for who in ('outsider','learner-2'):
        assert c.get('/api/materials/'+allowed+'/file',headers=h[who]).status_code==404
    for m in c.get('/api/materials',headers=h['learner']).json(): assert 'content' not in m
    assert upload(relationship_id='demo-link-2').status_code==422
    assert upload(file_name='../lesson.txt').status_code==422
    assert upload(file_name='x.html').status_code==422
    assert upload(content='я'*31000).status_code==422
    assert upload(content='a\0b').status_code==422
    captured=[]
    from apps.server.ai import LocalRules
    original=LocalRules.analyze
    from unittest.mock import patch
    def analyze(self,context): captured.append(context);return original(self,context)
    submit(c,h['learner'])
    with patch.object(LocalRules,'analyze',analyze): asyncio.run(app.state.process_one())
    assert captured[0]['materials']==[{'title':'Конспект','text':'Разрешённое объяснение'}]
    assert 'PRIVATE MATERIAL' not in str(captured)


def test_lesson_binding_and_exact_txt_whitespace(env):
    c,app,cfg,h=env
    lesson=c.get('/api/lessons',headers=h['tutor']).json()[0]
    source=c.get('/api/assignments/demo-assignment',headers=h['tutor']).json()
    body={k:source[k] for k in ('relationship_id','title','tasks')}
    body['lesson_id']=lesson['id']
    aid=c.post('/api/assignments',headers=h['tutor'],json=body).json()['id']
    assert c.get('/api/assignments/'+aid,headers=h['tutor']).json()['lesson_id']==lesson['id']
    body['relationship_id']='demo-link-2'
    assert c.post('/api/assignments',headers=h['tutor'],json=body).status_code==404
    text='  Первая строка\r\nВторая\n'
    mid=c.post('/api/materials',headers=h['tutor'],json={'relationship_id':'demo-link','title':'Конспект занятия','file_name':'exact.txt','content':text,'lesson_id':lesson['id'],'ai_allowed':True}).json()['id']
    assert c.get('/api/materials/'+mid+'/file',headers=h['learner']).json()['content']==text
    from apps.server.ai import LocalRules
    from unittest.mock import patch
    captured=[];original=LocalRules.analyze
    def analyze(self,context): captured.append(context);return original(self,context)
    submit(c,h['learner'])
    with patch.object(LocalRules,'analyze',analyze): asyncio.run(app.state.process_one())
    assert captured[0]['materials']==[]
    c.post('/api/assignments/'+aid+'/publish',headers=h['tutor'])
    submit(c,h['learner'],aid)
    with patch.object(LocalRules,'analyze',analyze): asyncio.run(app.state.process_one())
    assert captured[1]['materials']==[{'title':'Конспект занятия','text':text}]


def test_material_of_unpublished_assignment_is_hidden_and_lesson_status_safe(env):
    c,app,cfg,h=env
    source=c.get('/api/assignments/demo-assignment',headers=h['tutor']).json()
    body={k:source[k] for k in ('relationship_id','title','tasks')}
    aid=c.post('/api/assignments',headers=h['tutor'],json=body).json()['id']
    mid=c.post('/api/materials',headers=h['tutor'],json={'relationship_id':'demo-link','title':'Скрытый TXT','file_name':'draft.txt','content':'Текст черновика','assignment_id':aid}).json()['id']
    assert all(m['id']!=mid for m in c.get('/api/materials',headers=h['learner']).json())
    assert c.get('/api/materials/'+mid+'/file',headers=h['learner']).status_code==404
    lesson=c.get('/api/lessons',headers=h['tutor']).json()[0]
    lid=lesson.pop('id');lesson['status']='cancelled';lesson['payment_status']='unpaid'
    assert c.put('/api/lessons/'+lid,headers=h['tutor'],json=lesson).status_code==200
    view=c.get('/api/lessons',headers=h['learner']).json()[0]
    assert view['status']=='cancelled' and 'payment_status' not in view
