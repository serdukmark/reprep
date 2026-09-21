"""One explicitly requested paid synthetic question, without MAX or publication."""
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
    if not args.run:raise SystemExit('Use --run for one synthetic OpenRouter question with the configured model.')
    root=Path(__file__).resolve().parents[1];cfg=Settings.load()
    if not cfg.openrouter_key or not cfg.openrouter_model:raise SystemExit('OpenRouter configuration missing; values not displayed.')
    with tempfile.TemporaryDirectory(dir=root/'artifacts') as tmp:
        cfg=replace(cfg,database=str(Path(tmp)/'question.sqlite'),environment='test',demo=True,bot_token='',public_base_url='',max_bot_enabled=False,max_outbound_enabled=False,ai_daily_limit=1,ai_url='',synthetic_only=True)
        engine=OpenRouterAdapter(cfg.openrouter_key,cfg.openrouter_model)
        app=create_app(cfg,provider=engine,run_worker=False)
        with TestClient(app) as c:
            def headers(who):return {'Authorization':'Bearer '+c.post('/api/auth/demo/'+who).json()['token']}
            learner,tutor=headers('learner'),headers('tutor')
            response=c.post('/api/assignments/demo-assignment/questions',headers=learner,json={'client_id':'live-synthetic-question-v1','task_id':'linear','text':'Не понимаю, какое первое действие нужно выполнить с обеими частями. Подскажи один шаг, не сообщая ответ.'})
            if response.status_code!=201:raise SystemExit('Question creation failed; raw response withheld.')
            qid=response.json()['id'];asyncio.run(app.state.process_question())
            q=c.get('/api/assignments/demo-assignment/questions',headers=tutor).json()[0]
            draft=q['draft']
            if not draft or draft['engine']=='unavailable':raise SystemExit('Live question AI failed; question preserved for teacher. No successful result claimed.')
            hidden=c.get('/api/assignments/demo-assignment/questions',headers=learner).json()[0]['draft'] is None
            result=c.post('/api/questions/'+qid+'/review',headers=tutor,json={'text':draft['text']})
            shown=c.get('/api/assignments/demo-assignment/questions',headers=learner).json()[0]
            if result.status_code!=200 or shown['response']!=draft['text']:raise SystemExit('Teacher confirmation failed.')
            evidence={'synthetic':True,'model':cfg.openrouter_model,'prompt_version':draft['prompt_version'],'draft_hidden_before_review':hidden,
                'response':draft,'teacher_confirmation':'API test role; not an independent pedagogical review','learner_received_confirmed_response':True,
                'inside_MAX':False,'price_cap_per_million':{'input_usd':1,'output_usd':1},'usage':getattr(engine,'last_question_usage',{})}
            (root/'docs/evidence/live-question-v3.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
            print('PASS: synthetic question -> live OpenRouter -> API tutor confirmation -> learner sees confirmed response. MAX not tested.')


if __name__=='__main__':main()
