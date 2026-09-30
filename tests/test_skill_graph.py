import asyncio
import pytest
from tests.test_workflow import env,submit,review
from apps.server.db import connect


def graph():
    return {'revision':0,'skills':['Линейные уравнения','Следующий навык'],'edges':[{'prerequisite':'Линейные уравнения','skill':'Следующий навык'}]}


def test_graph_only_uses_confirmed_evidence_and_never_creates_it(env):
    c,app,cfg,h=env;path='/api/relationships/demo-link/skill-graph'
    saved=c.put(path,headers=h['tutor'],json=graph())
    assert saved.status_code==200 and saved.json()['revision']==1
    assert saved.json()['nodes'][1]['prerequisites_confirmed'] is False
    assert c.get('/api/relationships/demo-link/progress',headers=h['tutor']).json()==[]
    sid=submit(c,h['learner']).json()['id'];asyncio.run(app.state.process_one())
    assert c.get(path,headers=h['learner']).json()['nodes'][0]['evidence_count']==0
    review(c,h['tutor'],sid)
    result=c.get(path,headers=h['learner']).json()
    assert result['nodes'][0]['latest']=='correct' and result['nodes'][0]['evidence_count']==1
    assert result['nodes'][1]['prerequisites_confirmed'] is True
    assert result['nodes'][1]['latest']=='unknown'
    assert c.put(path,headers=h['tutor'],json=graph()).status_code==409
    assert c.put(path,headers=h['learner'],json=graph()).status_code==403
    assert c.get(path,headers=h['outsider']).status_code==404


def test_graph_rejects_cycles_unknown_skills_and_duplicate_nodes(env):
    c,app,cfg,h=env;path='/api/relationships/demo-link/skill-graph'
    for body in [
        {'revision':0,'skills':['А','А'],'edges':[]},
        {'revision':0,'skills':['А'],'edges':[{'prerequisite':'Б','skill':'А'}]},
        {'revision':0,'skills':['А','Б'],'edges':[{'prerequisite':'А','skill':'Б'},{'prerequisite':'Б','skill':'А'}]},
    ]:
        assert c.put(path,headers=h['tutor'],json=body).status_code==422
    assert c.get(path,headers=h['tutor']).json()['revision']==0


@pytest.mark.parametrize(('old_correctness','new_correctness'),[
    ('correct','incorrect'),('incorrect','correct'),
])
def test_graph_merges_case_variants_without_losing_latest_evidence(env,old_correctness,new_correctness):
    c,app,cfg,h=env;path='/api/relationships/demo-link/skill-graph'
    assert c.put(path,headers=h['tutor'],json=graph()).status_code==200
    first=submit(c,h['learner']).json()['id']
    assert review(c,h['tutor'],first,correctness=old_correctness).status_code==200
    original=c.get('/api/assignments/demo-assignment',headers=h['tutor']).json()
    body={key:original[key] for key in ('relationship_id','title','instructions','due_at','feedback_policy','tasks')}
    body['tasks'][0]['skill']='линейные УРАВНЕНИЯ'
    created=c.post('/api/assignments',headers=h['tutor'],json=body)
    assert created.status_code==201
    assignment_id=created.json()['id']
    assert c.post('/api/assignments/'+assignment_id+'/publish',headers=h['tutor']).status_code==200
    second=submit(c,h['learner'],assignment_id).json()['id']
    assert review(c,h['tutor'],second,correctness=new_correctness).status_code==200
    with connect(cfg.database) as db:
        db.execute("UPDATE evidence SET created='2026-09-20T10:00:00+00:00' WHERE submission_id=?",(first,))
        db.execute("UPDATE evidence SET created='2026-09-21T10:00:00+00:00' WHERE submission_id=?",(second,))
    history=c.get('/api/relationships/demo-link/progress',headers=h['learner']).json()
    variants=[row for row in history if row['skill'].casefold()=='линейные уравнения']
    assert len(variants)==2  # Raw progress API keeps its existing grouping.
    expected_ids=[row['evidence'][0]['id'] for row in variants]
    result=c.get(path,headers=h['learner']).json()
    node=result['nodes'][0]
    assert node['skill']=='Линейные уравнения'
    assert node['latest']==new_correctness
    assert node['correct']==1 and node['total']==2 and node['evidence_count']==2
    assert node['evidence_ids']==expected_ids
    assert result['nodes'][1]['evidence_ids']==[]
    assert result['nodes'][1]['prerequisites_confirmed'] is (new_correctness=='correct')
    assert 'Линейные уравнения' in result['available_skills']
    assert 'линейные УРАВНЕНИЯ' not in result['available_skills']
    declared=app.openapi()['components']['schemas']['SkillGraphView']['properties']['nodes']['items']
    assert 'evidence_ids' in declared['required']
    assert declared['properties']['evidence_ids']=={'type':'array','items':{'type':'string'}}


def test_deeper_analytics_measures_wait_and_review_disagreement_only(env):
    c,app,cfg,h=env
    assert c.get('/api/analytics',headers=h['tutor']).json()['median_review_wait_seconds'] is None
    sid=submit(c,h['learner']).json()['id'];asyncio.run(app.state.process_one())
    review(c,h['tutor'],sid)
    with connect(cfg.database) as db:
        db.execute("UPDATE submissions SET submitted='2026-09-21T00:00:00+00:00' WHERE id=?",(sid,))
        db.execute("UPDATE reviews SET created='2026-09-21T00:10:00+00:00' WHERE submission_id=?",(sid,))
    stats=c.get('/api/analytics',headers=h['tutor']).json()
    assert stats['median_review_wait_seconds']==600 and stats['reviewed_attempts']==1
    assert stats['compared_task_results']==3 and stats['changed_task_results']>=1
    assert c.get('/api/analytics',headers=h['outsider']).json()['compared_task_results']==0
