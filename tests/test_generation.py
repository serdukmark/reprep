import asyncio
from unittest.mock import patch
import pytest
from tests.test_questions import qenv
from apps.server.models import GeneratedWork


def material(c,h,allowed=True):
    return c.post('/api/materials',headers=h,json={'relationship_id':'demo-link','title':'Сложение','file_name':'facts.txt','content':'Сумма двух и трёх равна пяти.','ai_allowed':allowed}).json()['id']


def generated():
    return GeneratedWork(title='Практика сложения',instructions='Решите пример.',tasks=[{'id':'t1','type':'numeric','prompt':'Чему равно 2 + 3?','answer':'5','rubric':'Сложить два и три.','skill':'Сложение','hint':'Посчитайте от двух ещё три шага.','options':[]}])


def test_generation_requires_permission_and_only_creates_private_draft(qenv):
    c,app,cfg,engine,h=qenv
    mid=material(c,h['tutor']);path='/api/materials/'+mid+'/generations'
    request={'client_id':'generate-synthetic-1','count':1}
    for who in ('learner','outsider'):
        assert c.post(path,headers=h[who],json=request).status_code in (403,404)
    forbidden=material(c,h['tutor'],False)
    assert c.post('/api/materials/'+forbidden+'/generations',headers=h['tutor'],json=request).status_code==422
    job=c.post(path,headers=h['tutor'],json=request).json()
    assert c.post(path,headers=h['tutor'],json=request).json()==job
    capture=[]
    def generate(context):capture.append(context);return generated()
    with patch.object(engine,'generate_assignment',side_effect=generate):asyncio.run(app.state.process_generation())
    assert capture==[{'count':1,'material':{'title':'Сложение','text':'Сумма двух и трёх равна пяти.'}}]
    result=c.get(path,headers=h['tutor']).json()[0]
    assert result['status']=='completed'
    aid=result['assignment_id']
    assert c.get('/api/assignments/'+aid,headers=h['tutor']).json()['status']=='draft'
    assert c.get('/api/assignments/'+aid,headers=h['learner']).status_code==404
    assert not asyncio.run(app.state.process_generation())
    copied=[m for m in c.get('/api/materials',headers=h['tutor']).json() if m.get('assignment_id')==aid]
    assert len(copied)==1
    assert c.get('/api/materials/'+copied[0]['id']+'/file',headers=h['learner']).status_code==404
    assert c.post('/api/assignments/'+aid+'/publish',headers=h['tutor']).status_code==200
    assert c.get('/api/materials/'+copied[0]['id']+'/file',headers=h['learner']).json()['content']=='Сумма двух и трёх равна пяти.'
    assert c.get('/api/assignments/'+aid,headers=h['learner']).json()['tasks'][0]['prompt']=='Чему равно 2 + 3?'
    assert c.post('/api/demo/reset',headers=h['tutor']).status_code==200


@pytest.mark.parametrize('output',[RuntimeError('unavailable'),ValueError('empty or garbage'),{}],ids=['provider','invalid','schema'])
def test_failed_generation_preserves_material_without_publishing(qenv,output):
    c,app,cfg,engine,h=qenv
    mid=material(c,h['tutor']);path='/api/materials/'+mid+'/generations'
    before=c.get('/api/assignments',headers=h['tutor']).json()
    c.post(path,headers=h['tutor'],json={'client_id':'generate-failure-1','count':1})
    kwargs={'side_effect':output} if isinstance(output,Exception) else {'return_value':output}
    with patch.object(engine,'generate_assignment',**kwargs):asyncio.run(app.state.process_generation())
    result=c.get(path,headers=h['tutor']).json()[0]
    assert result['status']=='failed' and result['assignment_id'] is None
    assert c.get('/api/assignments',headers=h['tutor']).json()==before
    assert c.get('/api/materials/'+mid+'/file',headers=h['tutor']).json()['content']=='Сумма двух и трёх равна пяти.'


def test_generation_uses_global_limit_and_validates_count(qenv):
    c,app,cfg,engine,h=qenv
    cfg.ai_daily_limit=0;mid=material(c,h['tutor']);path='/api/materials/'+mid+'/generations'
    c.post(path,headers=h['tutor'],json={'client_id':'generate-limit-1','count':1})
    with patch.object(engine,'generate_assignment') as mocked:
        asyncio.run(app.state.process_generation());mocked.assert_not_called()
    cfg.ai_daily_limit=50
    c.post(path,headers=h['tutor'],json={'client_id':'generate-count-2','count':2})
    with patch.object(engine,'generate_assignment',return_value=generated()):asyncio.run(app.state.process_generation())
    assert all(x['status']=='failed' for x in c.get(path,headers=h['tutor']).json())


def test_generation_model_price_schema_and_context_cap():
    import json
    from apps.server.ai import OpenRouterAdapter,ContextTooLarge
    class Response:
        status_code=200
        def json(self):return {'choices':[{'finish_reason':'stop','message':{'content':json.dumps(generated().model_dump())}}]}
    with patch('apps.server.ai.httpx.Client') as cls:
        client=cls.return_value.__enter__.return_value;client.post.return_value=Response()
        engine=OpenRouterAdapter('synthetic-credential','synthetic-model')
        result=engine.generate_assignment({'count':1,'material':{'text':'Два плюс три равно пяти.'}})
        assert result.tasks[0].answer=='5'
        payload=client.post.call_args.kwargs['json']
        assert payload['provider']['max_price']=={'prompt':1,'completion':1}
        assert payload['provider']['data_collection']=='deny'
        assert payload['response_format']['json_schema']['strict'] is True
        client.post.reset_mock()
        with pytest.raises(ContextTooLarge):engine.generate_assignment({'count':1,'material':{'text':'я'*40000}})
        client.post.assert_not_called()
