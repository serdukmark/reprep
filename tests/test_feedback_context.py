import asyncio
from unittest.mock import patch
from tests.test_workflow import env,submit
from apps.server.ai import LocalRules


def test_context_has_only_own_subject_level_instructions_and_confirmed_history(env):
    c,app,cfg,h=env
    body={'revision':0,'goal':'Отработать уравнения','level':'Начальный','steps':[]}
    assert c.put('/api/relationships/demo-link/plan',headers=h['tutor'],json=body).status_code==200
    assert c.put('/api/relationships/demo-link-2/plan',headers=h['tutor'],json={**body,'level':'ЧУЖОЙ УРОВЕНЬ'}).status_code==200
    original=LocalRules.analyze;captured=[]
    def capture(self,context):captured.append(context);return original(self,context)
    submit(c,h['learner'])
    with patch.object(LocalRules,'analyze',capture):asyncio.run(app.state.process_one())
    context=captured[0]
    assert context['learning_context']['subject']=='Математика · ЕГЭ' and context['learning_context']['level']=='Начальный'
    assert context['instructions'] and context['confirmed_history']==[]
    assert 'ЧУЖОЙ УРОВЕНЬ' not in str(context) and 'Саша' not in str(context)
    assert context['context_version']=='assessment-context-v3'


def test_feedback_categories_private_export_and_access(env):
    c,app,cfg,h=env
    for category in ('useful','incorrect_feedback','harmful_feedback','bug'):
        r=c.post('/api/reports',headers=h['learner'],json={'context_id':'demo-assignment','category':category,'text':'Комментарий ученика'})
        assert r.status_code==200
    exported=c.get('/api/account/export',headers=h['learner']).json()['reports']
    assert {r['category'] for r in exported}=={'useful','incorrect_feedback','harmful_feedback','bug'}
    assert c.get('/api/account/export',headers=h['learner-2']).json()['reports']==[]
    assert c.post('/api/reports',headers=h['learner-2'],json={'context_id':'demo-assignment','category':'harmful_feedback'}).status_code==404
    assert c.post('/api/reports',headers=h['learner'],json={'context_id':'demo-assignment','category':'made-up'}).status_code==422
