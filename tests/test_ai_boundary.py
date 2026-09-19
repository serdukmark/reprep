import asyncio
import json
from unittest.mock import patch
from fastapi.testclient import TestClient
from apps.server.ai import OpenRouterAdapter, LocalRules
from apps.server.config import Settings
from apps.server.main import create_app
from scripts.benchmark_ai import fixture
from concurrent.futures import ThreadPoolExecutor


def test_openrouter_hard_price_and_data_routing():
    context,_=fixture()
    output=LocalRules().analyze(context).model_dump()
    class Response:
        status_code=200
        def json(self):
            return {'choices':[{'finish_reason':'stop','message':{'content':json.dumps(output)}}]}
    with patch('apps.server.ai.httpx.Client') as cls:
        client=cls.return_value.__enter__.return_value
        client.post.return_value=Response()
        OpenRouterAdapter('synthetic-test-credential','test-model').analyze(context)
        payload=client.post.call_args.kwargs['json']
        assert payload['provider']['max_price']=={'prompt':1,'completion':1}
        assert payload['provider']['data_collection']=='deny'
        assert payload['provider']['require_parameters'] is True
        assert payload['max_tokens']==6000
        assert payload['response_format']['json_schema']['strict'] is True


def test_daily_budget_exhaustion_preserves_manual_review(tmp_path):
    cfg=Settings(database=str(tmp_path/'limit.sqlite'),demo=True,environment='test',ai_daily_limit=0)
    provider=OpenRouterAdapter('synthetic-test-credential','test-model')
    app=create_app(cfg,provider=provider,run_worker=False)
    with TestClient(app) as c, patch.object(provider,'analyze') as paid:
        h={'Authorization':'Bearer '+c.post('/api/auth/demo/learner').json()['token']}
        r=c.post('/api/assignments/demo-assignment/submit',headers=h,json={'revision':0,'answers':{'linear':'5','fraction':'0,75','reason':'Одинаковое изменение сохраняет равенство.'}})
        assert r.status_code==200
        asyncio.run(app.state.process_one())
        paid.assert_not_called()
        h={'Authorization':'Bearer '+c.post('/api/auth/demo/tutor').json()['token']}
        s=c.get('/api/assignments/demo-assignment',headers=h).json()['submission']
        assert s['status']=='awaiting_review'
        assert s['analysis']['assessment_status']=='provider_unavailable'
        assert s['answers']['linear']=='5'


def test_background_worker_does_not_block_parallel_dashboard_reads(tmp_path):
    cfg=Settings(database=str(tmp_path/'concurrent.sqlite'),demo=True,environment='test')
    with TestClient(create_app(cfg,run_worker=True)) as c:
        h={'Authorization':'Bearer '+c.post('/api/auth/demo/tutor').json()['token']}
        endpoints=['relationships','assignments','lessons','materials']*5
        with ThreadPoolExecutor(max_workers=4) as pool:
            results=list(pool.map(lambda path:c.get('/api/'+path,headers=h),endpoints))
        assert all(r.status_code==200 for r in results)
