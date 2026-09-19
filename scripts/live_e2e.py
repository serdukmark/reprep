"""Explicitly paid synthetic full API workflow. No MAX messages are sent."""
import asyncio
import json
import tempfile
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from apps.server.config import Settings
from apps.server.main import create_app
from apps.server.ai import OpenRouterAdapter
from scripts.benchmark_ai import fixture

cfg=Settings.load()
if not cfg.openrouter_model: raise SystemExit('Select OPENROUTER_MODEL first')
adapter=OpenRouterAdapter(cfg.openrouter_key,cfg.openrouter_model)
with tempfile.TemporaryDirectory() as d:
    settings=Settings(database=d+'/live.sqlite',environment='test',demo=True)
    app=create_app(settings,provider=adapter,run_worker=False)
    with TestClient(app) as c:
        headers={role:{'Authorization':'Bearer '+c.post('/api/auth/demo/'+role).json()['token']} for role in ('tutor','learner')}
        ctx,expected=fixture()
        task={'relationship_id':'demo-link','title':'Живая проверка: алгебра и объяснения','instructions':'Синтетическая работа для проверки интеграции.',
              'feedback_policy':'after_review','tasks':ctx['tasks'],'due_at':None}
        r=c.post('/api/assignments',headers=headers['tutor'],json=task)
        assert r.status_code==201,r.text
        aid=r.json()['id']
        assert c.post('/api/assignments/'+aid+'/publish',headers=headers['tutor']).status_code==200
        r=c.post('/api/assignments/'+aid+'/submit',headers=headers['learner'],json={'revision':0,'answers':ctx['answers']})
        assert r.status_code==200,r.text
        sid=r.json()['id']
        asyncio.run(app.state.process_one())
        result=c.get('/api/assignments/'+aid,headers=headers['tutor']).json()['submission']
        assert result['analysis']['engine']==cfg.openrouter_model,result['analysis']['assessment_status']
        assert len(result['analysis']['tasks'])==6
        check={'action':'confirmed','tasks':[{'task_id':t['task_id'],'correctness':t['correctness'],'feedback':t['feedback_for_learner']} for t in result['analysis']['tasks']],'note':'Синтетический сквозной прогон; не результат пользовательского пилота.'}
        r=c.post('/api/submissions/'+sid+'/review',headers=headers['tutor'],json=check)
        assert r.status_code==200,r.text
        final=c.get('/api/assignments/'+aid,headers=headers['learner']).json()['submission']
        assert final['status']=='reviewed' and final['analysis'] is None and final['review']['action']=='confirmed'
        assert final['answers']==ctx['answers']
        skills=c.get('/api/relationships/demo-link/progress',headers=headers['learner']).json()
        assert sum(len(s['evidence']) for s in skills)==6
        report={'model':cfg.openrouter_model,'flow':'tutor_create_publish → learner_submit → live_openrouter → tutor_confirm → learner_feedback_and_progress',
                'passed':True,'max_webview_tested':False,'synthetic_data':True,'usage':adapter.last_usage,
                'matching_labels':sum(t['correctness']==expected[t['task_id']] for t in result['analysis']['tasks']),
                'analysis':result['analysis']}
        Path('artifacts').mkdir(exist_ok=True)
        Path('artifacts/live-e2e.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
        print(json.dumps({k:v for k,v in report.items() if k!='analysis'},ensure_ascii=False,indent=2))
