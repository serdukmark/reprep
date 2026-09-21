"""One paid synthetic generation. No MAX and no external publication."""
import argparse
import asyncio
import json
from dataclasses import replace
from pathlib import Path
import tempfile
from fastapi.testclient import TestClient
from apps.server.main import create_app
from apps.server.config import Settings
from apps.server.ai import OpenRouterAdapter


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--run',action='store_true');args=parser.parse_args()
    if not args.run:raise SystemExit('Use --run for one paid synthetic generation.')
    cfg=Settings.load();root=Path(__file__).resolve().parents[1]
    if not cfg.openrouter_key or not cfg.openrouter_model:raise SystemExit('OpenRouter configuration missing; values withheld.')
    with tempfile.TemporaryDirectory(dir=root/'artifacts') as tmp:
        cfg=replace(cfg,database=str(Path(tmp)/'generation.sqlite'),environment='test',demo=True,bot_token='',public_base_url='',max_bot_enabled=False,max_outbound_enabled=False,ai_url='',ai_daily_limit=1,synthetic_only=True)
        engine=OpenRouterAdapter(cfg.openrouter_key,cfg.openrouter_model);app=create_app(cfg,provider=engine,run_worker=False)
        with TestClient(app) as c:
            def login(who):return {'Authorization':'Bearer '+c.post('/api/auth/demo/'+who).json()['token']}
            tutor,learner=login('tutor'),login('learner')
            text='Линейное уравнение 3x + 7 = 22 решают одинаковыми операциями над обеими частями. Сначала из обеих частей вычитают 7: 3x = 15. Затем обе части делят на 3: x = 5. Проверка: 3 * 5 + 7 = 22.'
            material=c.post('/api/materials',headers=tutor,json={'relationship_id':'demo-link','title':'Метод решения уравнения','file_name':'synthetic.txt','content':text,'ai_allowed':True}).json()['id']
            path='/api/materials/'+material+'/generations'
            if c.post(path,headers=tutor,json={'client_id':'live-generation-001','count':2}).status_code!=201:raise SystemExit('Generation enqueue failed.')
            asyncio.run(app.state.process_generation())
            job=c.get(path,headers=tutor).json()[0]
            if job['status']!='completed':raise SystemExit('Live generation failed; material preserved. No successful draft claimed.')
            draft=c.get('/api/assignments/'+job['assignment_id'],headers=tutor).json()
            hidden=c.get('/api/assignments/'+job['assignment_id'],headers=learner).status_code==404
            evidence={'synthetic':True,'model':cfg.openrouter_model,'prompt_version':'generation-v2','material':text,
                'tasks':draft['tasks'],'title':draft['title'],'status':draft['status'],'hidden_from_learner':hidden,
                'automatically_published':False,'inside_MAX':False,'usage':getattr(engine,'last_generation_usage',{}),
                'review':'Generated reference answers require tutor review before publication; this run deliberately leaves a draft.'}
            (root/'docs/evidence/live-generation-v2.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
            print('PASS: approved synthetic TXT -> live OpenRouter -> validated private draft (not published).')


if __name__=='__main__':main()
