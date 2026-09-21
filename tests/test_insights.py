import asyncio
from tests.test_workflow import env, submit, review


def test_recommendations_require_confirmed_evidence_and_remain_drafts(env):
    c,app,cfg,h=env
    path='/api/relationships/demo-link/recommendations'
    assert c.get(path,headers=h['tutor']).json()==[]
    sid=submit(c,h['learner']).json()['id']
    asyncio.run(app.state.process_one())
    assert c.get(path,headers=h['tutor']).json()==[]
    assert review(c,h['tutor'],sid,correctness='partially_correct').status_code==200
    items=c.get(path,headers=h['tutor']).json()
    assert len(items)==3 and all(i['basis']=='tutor_confirmed_history' and not i['automatic_assignment'] for i in items)
    assert all(i['source_assignment_id']=='demo-assignment' and i['evidence_id'] for i in items)
    draft=c.post('/api/assignments/'+items[0]['source_assignment_id']+'/duplicate',headers=h['tutor']).json()['id']
    assert c.get('/api/assignments/'+draft,headers=h['tutor']).json()['status']=='draft'
    assert c.get('/api/assignments/'+draft,headers=h['learner']).status_code==404
    for who in ('outsider','learner','learner-2'):
        assert c.get(path,headers=h[who]).status_code in (403,404)


def test_analytics_and_export_do_not_mix_tutors_or_raw_answers(env):
    c,app,cfg,h=env
    sid=submit(c,h['learner']).json()['id'];asyncio.run(app.state.process_one())
    review(c,h['tutor'],sid)
    stats=c.get('/api/analytics',headers=h['tutor']).json()
    assert stats['submissions']==1 and stats['review_actions']['corrected']==1
    assert stats['external_ai_attempts_today']==0 and stats['ai_failures']==0
    assert c.get('/api/analytics',headers=h['outsider']).json()['submissions']==0
    assert c.get('/api/analytics',headers=h['learner']).status_code==403
    export=c.get('/api/relationships/demo-link/export',headers=h['learner']).json()
    assert len(export['progress'])==3
    assert all(e['submission_id']==sid for s in export['progress'] for e in s['evidence'])
    assert 'answers' not in str(export) and 'analysis' not in str(export)
    assert c.get('/api/relationships/demo-link/export',headers=h['outsider']).status_code==404
