import asyncio
import json
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from apps.server.main import create_app
from apps.server.config import Settings
from apps.server.ai import OpenRouterAdapter
from apps.server.models import QuestionAnswer
from apps.server.db import connect


@pytest.fixture
def qenv(tmp_path):
    cfg=Settings(database=str(tmp_path/'questions.sqlite'),demo=True,environment='test')
    engine=OpenRouterAdapter('synthetic-test-credential','synthetic-model')
    app=create_app(cfg,provider=engine,run_worker=False)
    with TestClient(app) as c:
        headers={who:{'Authorization':'Bearer '+c.post('/api/auth/demo/'+who).json()['token']} for who in ('tutor','learner','learner-2','outsider')}
        yield c,app,cfg,engine,headers


def ask(c,h,assignment='demo-assignment',key='question-test-001'):
    return c.post('/api/assignments/'+assignment+'/questions',headers=h,json={'client_id':key,'task_id':'linear','text':'С чего начать решение?'})


def test_question_bound_context_review_privacy_and_replay(qenv):
    c,app,cfg,engine,h=qenv
    qid=ask(c,h['learner']).json()['id']
    assert ask(c,h['learner']).json()['id']==qid
    capture=[]
    def answer(context):
        capture.append(context)
        return QuestionAnswer(status='answered',text='Попробуйте вычесть одинаковое число из обеих частей.',confidence=.7)
    with patch.object(engine,'answer_question',side_effect=answer):asyncio.run(app.state.process_question())
    assert len(capture)==1 and set(capture[0]['task'])=={'prompt','type','skill','options','hint'}
    assert 'answers' not in capture[0] and 'answer' not in capture[0]['task'] and 'rubric' not in capture[0]['task']
    path='/api/assignments/demo-assignment/questions'
    tutor=c.get(path,headers=h['tutor']).json()[0]
    learner=c.get(path,headers=h['learner']).json()[0]
    assert tutor['draft']['engine']=='synthetic-model' and tutor['draft']['prompt_version']=='question-v3'
    assert learner['draft'] is None and learner['response'] is None and learner['status']=='awaiting_review'
    for who in ('learner-2','outsider'):
        assert c.get(path,headers=h[who]).status_code==404
    assert c.post('/api/questions/'+qid+'/review',headers=h['learner'],json={'text':'Подмена'}).status_code==403
    assert c.post('/api/questions/'+qid+'/review',headers=h['outsider'],json={'text':'Подмена'}).status_code==404
    assert c.post('/api/questions/'+qid+'/review',headers=h['tutor'],json={'text':'Сначала посмотрите на свободный член.'}).status_code==200
    result=c.get(path,headers=h['learner']).json()[0]
    assert result['response']=='Сначала посмотрите на свободный член.' and result['draft'] is None
    assert c.get('/api/relationships/demo-link/progress',headers=h['learner']).json()==[]
    assert c.post('/api/questions/'+qid+'/review',headers=h['tutor'],json={'text':'Другой ответ'}).status_code==409


@pytest.mark.parametrize('failure',[RuntimeError('offline'),ValueError('bad schema'),TimeoutError('disconnect')],ids=['provider','schema','network'])
def test_question_failure_goes_to_teacher(qenv,failure):
    c,app,cfg,engine,h=qenv
    ask(c,h['learner'])
    with patch.object(engine,'answer_question',side_effect=failure):asyncio.run(app.state.process_question())
    result=c.get('/api/assignments/demo-assignment/questions',headers=h['learner']).json()[0]
    assert result['question']=='С чего начать решение?' and result['status']=='awaiting_review' and result['needs_teacher']
    assert result['draft'] is None and result['response'] is None


def test_question_limit_and_real_data_gate(qenv):
    c,app,cfg,engine,h=qenv
    cfg.ai_daily_limit=0;ask(c,h['learner'])
    with patch.object(engine,'answer_question') as mock:
        asyncio.run(app.state.process_question());mock.assert_not_called()
    cfg.ai_daily_limit=50
    with connect(cfg.database) as db:db.execute("UPDATE users SET demo=0 WHERE id='demo-learner'")
    ask(c,h['learner'],key='question-test-002')
    with patch.object(engine,'answer_question') as mock:
        asyncio.run(app.state.process_question());mock.assert_not_called()


@pytest.mark.parametrize('content',['','not JSON','{}'],ids=['empty','garbage','schema'])
def test_question_openrouter_rejects_bad_output_and_caps_price(content):
    class Response:
        status_code=200
        def json(self):return {'choices':[{'finish_reason':'stop','message':{'content':content}}]}
    with patch('apps.server.ai.httpx.Client') as cls:
        client=cls.return_value.__enter__.return_value;client.post.return_value=Response()
        with pytest.raises(ValueError):OpenRouterAdapter('synthetic-credential','synthetic-model').answer_question({'question':'Что делать?'})
        payload=client.post.call_args.kwargs['json']
        assert payload['provider']['max_price']=={'prompt':1,'completion':1}
        assert payload['provider']['data_collection']=='deny' and payload['max_tokens']==1200


def test_question_two_learners_and_teacher_race(qenv):
    c,app,cfg,engine,h=qenv
    one=ask(c,h['learner']).json()['id'];two=ask(c,h['learner-2'],'demo-assignment-2').json()['id']
    def answer(context):return QuestionAnswer(status='needs_teacher',text='Уточните у преподавателя.',confidence=0)
    async def run():await asyncio.gather(app.state.process_question(),app.state.process_question())
    with patch.object(engine,'answer_question',side_effect=answer):asyncio.run(run())
    for assignment,qid,who in [('demo-assignment',one,'learner'),('demo-assignment-2',two,'learner-2')]:
        view=c.get('/api/assignments/'+assignment+'/questions',headers=h[who]).json()
        assert len(view)==1 and view[0]['id']==qid and view[0]['status']=='awaiting_review'
    assert c.post('/api/demo/reset',headers=h['tutor']).status_code==200
