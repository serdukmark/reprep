import copy
import hashlib
import hmac
import json
import time
from urllib.parse import urlencode
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from apps.server.auth import verify_max
from apps.server.config import Settings
from apps.server.main import create_app
from apps.server.db import connect,one
from apps.server.max_bot import webhook_secret,process_outbox,MaxAPI,public_origin

# Frozen vector generated independently with Node crypto, not our Python signer.
TOKEN='synthetic-max-test-token'
VECTOR='auth_date=1800000000&query_id=fixture-query&user=%7B%22id%22%3A123456789%2C%22first_name%22%3A%22%D0%90%D0%BD%D0%BD%D0%B0+%2B+%D0%81%D0%B6%22%2C%22username%22%3Anull%7D&start_param=invite_test-42&hash=1065edf8a5b8fa53944a97d07e30e2b9e2f9b100051e578df14c269c32ce5962'


def test_frozen_vector_and_auth_tampering():
    assert verify_max(VECTOR,TOKEN,1800000000)=='123456789'
    for bad in [VECTOR.replace('123456789','987654321'),VECTOR+'&hash=abc',VECTOR+'&user=x',VECTOR.replace('%2B','%20'),VECTOR.replace('%7B','%XZ'),VECTOR.replace('fixture-query','changed')]:
        with pytest.raises(ValueError): verify_max(bad,TOKEN,1800000000)
    with pytest.raises(ValueError): verify_max(VECTOR,'wrong-token',1800000000)
    with pytest.raises(ValueError): verify_max(VECTOR,TOKEN,1800000301)
    with pytest.raises(ValueError): verify_max(VECTOR,TOKEN,1799999969)


def test_max_login_uses_verified_identity_and_retains_role(tmp_path):
    cfg=Settings(database=str(tmp_path/'login.sqlite'),bot_token=TOKEN)
    with TestClient(create_app(cfg,run_worker=False)) as c, patch('apps.server.auth.time.time',return_value=1800000000):
        body={'init_data':VECTOR,'role':'tutor','alias':'Тестовый преподаватель'}
        first=c.post('/api/auth/max',json=body)
        assert first.status_code==200
        second=c.post('/api/auth/max',json={**body,'role':'learner'})
        assert second.json()['user']['role']=='tutor'
        assert second.json()['user']['id']==first.json()['user']['id']
        bad=c.post('/api/auth/max',json={**body,'init_data':VECTOR.replace('123456789','987654321')})
        assert bad.status_code==401
        assert 'hash=' not in bad.text and TOKEN not in bad.text


def signed(token,identity=123456789):
    fields={'auth_date':str(int(time.time())),'user':json.dumps({'id':identity,'first_name':'Тест + Ёж'},ensure_ascii=False),'signature':'third-party-signature'}
    secret=hmac.digest(b'WebAppData',token.encode(),'sha256')
    fields['hash']=hmac.digest(secret,'\n'.join(k+'='+v for k,v in sorted(fields.items())).encode(),'sha256').hex()
    return urlencode(fields)


def test_repeat_launch_signs_in_without_role_or_name(tmp_path):
    cfg=Settings(database=str(tmp_path/'r.sqlite'),bot_token=TOKEN)
    with TestClient(create_app(cfg,run_worker=False)) as c:
        unknown=c.post('/api/auth/max',json={'init_data':signed(TOKEN,555000111)})
        assert unknown.status_code==409 and unknown.json()['error']['code']=='REGISTRATION_REQUIRED'
        assert 'token' not in unknown.text
        with connect(cfg.database) as db:
            assert one(db,'SELECT count(*) AS n FROM users WHERE demo=0')['n']==0
        first=c.post('/api/auth/max',json={'init_data':signed(TOKEN,555000111),'role':'learner','alias':'Катя'})
        assert first.status_code==200
        # Another device or a reopened mini app sends only the signed launch data.
        again=c.post('/api/auth/max',json={'init_data':signed(TOKEN,555000111)})
        assert again.status_code==200
        assert again.json()['user']==first.json()['user']
        assert again.json()['user']['role']=='learner' and again.json()['user']['alias']=='Катя'
        assert again.json()['token']!=first.json()['token']


def test_telegram_channel_is_gone(tmp_path):
    cfg=Settings(database=str(tmp_path/'t.sqlite'),bot_token=TOKEN)
    with TestClient(create_app(cfg,run_worker=False)) as c:
        for path in ('/api/auth/telegram','/api/telegram/webhook'):
            assert c.post(path,json={'init_data':signed(TOKEN)}).status_code in (404,405)
        assert 'telegram' not in c.get('/api/config').text
        policy=c.get('/api/config').headers['content-security-policy']
        assert 'telegram' not in policy and 'https://max.ru' in policy


@pytest.fixture
def max_env(tmp_path):
    cfg=Settings(database=str(tmp_path/'bot.sqlite'),bot_token=TOKEN,public_base_url='https://class.example.org',max_bot_id=111,max_bot_enabled=True)
    with TestClient(create_app(cfg,run_worker=False)) as c:
        yield cfg,c,{'X-Max-Bot-Api-Secret':webhook_secret(cfg)}


def started():
    return {'update_type':'bot_started','timestamp':int(time.time()*1000),'chat_id':5,'user':{'user_id':123,'first_name':'PRIVATE NAME','is_bot':False}}


def test_webhook_auth_duplicate_persistence_and_disabled_outbound(max_env):
    cfg,c,h=max_env;event=started()
    assert c.post('/api/max/webhook',json=event).status_code==401
    assert c.post('/api/max/webhook',headers={'X-Max-Bot-Api-Secret':TOKEN},json=event).status_code==401
    assert c.post('/api/max/webhook',headers=[*h.items(),*h.items()],json=event).status_code==401
    assert c.post('/api/max/webhook',headers=h,json=event).json()['status']=='queued'
    assert c.post('/api/max/webhook',headers=h,json=dict(reversed(list(event.items())))).json()['status']=='duplicate'
    with connect(cfg.database) as db:
        row=one(db,'SELECT * FROM max_outbox')
        assert row['recipient']==123 and 'PRIVATE NAME' not in row['body']
        assert 'open_app' in row['body'] and '111' in row['body']
    with patch('apps.server.max_bot.httpx.Client') as network:
        assert process_outbox(cfg) is False
        network.assert_not_called()


def test_webhook_commands_and_ignored_groups(max_env):
    cfg,c,h=max_env
    event={'update_type':'message_created','timestamp':int(time.time()*1000),'message':{'sender':{'user_id':123,'is_bot':False},'recipient':{'chat_type':'dialog'},'body':{'mid':'m1','text':'/help'}}}
    assert c.post('/api/max/webhook',headers=h,json=event).json()['status']=='queued'
    for change in ('group','bot','text','unknown'):
        other=copy.deepcopy(event)
        if change=='group':other['message']['recipient']['chat_type']='chat'
        if change=='bot':other['message']['sender']['is_bot']=True
        if change=='text':other['message']['body']['text']='PRIVATE homework'
        if change=='unknown':other['update_type']='future_event'
        assert c.post('/api/max/webhook',headers=h,json=other).json()['status']=='ignored'


def test_delivery_failure_is_bounded_and_secret_never_in_transport_url(max_env):
    cfg,c,h=max_env;c.post('/api/max/webhook',headers=h,json=started())
    cfg.max_outbound_enabled=True
    with patch.object(MaxAPI,'send',side_effect=RuntimeError('offline')) as send:
        for _ in range(3):
            assert process_outbox(cfg)
            with connect(cfg.database) as db:db.execute('UPDATE max_outbox SET available_at=0')
        assert process_outbox(cfg) is False
        assert send.call_count==3
    with patch('apps.server.max_bot.httpx.Client') as mock:
        client=mock.return_value.__enter__.return_value
        client.request.return_value.status_code=200
        client.request.return_value.json.return_value={'message':{'body':{'mid':'x'}}}
        MaxAPI(cfg).send(123,{'text':'Синтетика'})
        args=client.request.call_args
        assert args.args==('POST','https://platform-api2.max.ru/messages')
        assert args.kwargs['headers']=={'Authorization':TOKEN}
        assert args.kwargs['params']=={'user_id':123}


def test_chunked_body_is_bounded_before_validation(max_env):
    _,c,h=max_env
    r=c.post('/api/max/webhook',headers={**h,'Content-Type':'application/json'},content=iter([b'x'*80000,b'x'*80000]))
    assert r.status_code==413


@pytest.mark.parametrize('value',['http://class.example.org','https://class.example.org:443','https://a:b@class.example.org','https://class.example.org/app','https://localhost'])
def test_invalid_public_origin(value):
    with pytest.raises(ValueError):public_origin(value)
