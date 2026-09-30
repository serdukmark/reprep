from fastapi.testclient import TestClient
from apps.server.config import Settings
from apps.server.main import create_app
from tests.test_max import signed


def test_only_canonical_domain_can_login_and_write(tmp_path):
    canonical='https://reprep.ru'
    cfg=Settings(database=str(tmp_path/'origin.sqlite'),public_base_url=canonical,bot_token='synthetic-origin-test')
    with TestClient(create_app(cfg,run_worker=False)) as c:
        body={'init_data':signed(cfg.bot_token),'role':'tutor','alias':'Тест'}
        result=c.post('/api/auth/max',headers={'Origin':canonical},json=body)
        assert result.status_code==200
        headers={'Origin':canonical,'Authorization':'Bearer '+result.json()['token']}
        assert c.post('/api/logout',headers=headers).status_code==200
        for origin in ('https://reprep.2-26-49-28.nip.io','https://evil.test','null','http://reprep.ru',canonical+'.evil.test'):
            result=c.post('/api/auth/max',headers={'Origin':origin},json=body)
            assert result.status_code==403 and result.json()['error']['code']=='ORIGIN'
        assert c.post('/api/auth/max',headers=[('Origin',canonical),('Origin','https://evil.test')],json=body).status_code==403
        assert c.post('/api/auth/max',headers={'Origin':canonical},json={**body,'init_data':'hash=invalid'}).status_code==401
