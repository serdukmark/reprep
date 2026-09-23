import hashlib
import hmac
import json
import time
from urllib.parse import urlencode
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from apps.server.auth import verify_telegram
from apps.server.config import Settings
from apps.server.main import create_app
from apps.server.db import connect,one
from apps.server import telegram_bot,max_bot
from tests.test_max import VECTOR,TOKEN


def signed(token,identity=123456789):
    fields={'auth_date':str(int(time.time())),'user':json.dumps({'id':identity,'first_name':'Тест + Ёж'},ensure_ascii=False),'signature':'third-party-signature'}
    secret=hmac.digest(b'WebAppData',token.encode(),'sha256')
    fields['hash']=hmac.digest(secret,'\n'.join(k+'='+v for k,v in sorted(fields.items())).encode(),'sha256').hex()
    return urlencode(fields)


def test_independent_frozen_vector():
    assert verify_telegram(VECTOR,TOKEN,1800000000)=='telegram:123456789'
    for value in [VECTOR.replace('123456789','234567890'),VECTOR+'&hash=x',VECTOR+'&user=x']:
        with pytest.raises(ValueError):verify_telegram(value,TOKEN,1800000000)
    with pytest.raises(ValueError):verify_telegram(VECTOR,TOKEN,1800000301)
    with pytest.raises(ValueError):verify_telegram(VECTOR,'another-platform-token',1800000000)


def test_login_namespace_role_and_forgery(tmp_path):
    cfg=Settings(database=str(tmp_path/'t.sqlite'),bot_token=TOKEN,telegram_token=TOKEN,telegram_enabled=True,public_base_url='https://class.example.org')
    with TestClient(create_app(cfg,run_worker=False)) as c:
        data=signed(TOKEN);body={'init_data':data,'alias':'Тест','role':'tutor'}
        tg=c.post('/api/auth/telegram',json=body);assert tg.status_code==200
        mx=c.post('/api/auth/max',json=body);assert mx.status_code==200
        assert tg.json()['user']['id']!=mx.json()['user']['id']
        again=c.post('/api/auth/telegram',json={**body,'role':'learner'})
        assert again.json()['user']==tg.json()['user']
        assert c.post('/api/auth/telegram',json={**body,'init_data':data.replace('third-party-signature','forged')}).status_code==401
        assert c.get('/api/me',headers={'Authorization':'Bearer '+tg.json()['token']}).json()['role']=='tutor'
        assert c.get('/api/config').json()['telegram_enabled'] is True
        assert 'https://web.telegram.org' in c.get('/api/config').headers['content-security-policy']
        contract=c.get('/api/openapi.json').json()
        assert contract['paths']['/api/telegram/webhook']['post']['security']==[{'TelegramWebhookSecret':[]}]


def test_webhook_channel_isolation_duplicate_and_retry(tmp_path):
    cfg=Settings(database=str(tmp_path/'b.sqlite'),telegram_token=TOKEN,telegram_enabled=True,public_base_url='https://class.example.org',max_outbound_enabled=True,max_bot_enabled=True,bot_token='other-max-token',max_bot_id=111)
    event={'update_id':111,'message':{'date':int(time.time()),'text':'/start','chat':{'id':123,'type':'private'},'from':{'id':123,'is_bot':False}}}
    class Sender:
        def __init__(self):self.calls=[]
        def send(self,recipient,body):self.calls.append((recipient,body))
    sender=Sender()
    with TestClient(create_app(cfg,run_worker=False)) as c:
        assert c.post('/api/telegram/webhook',json=event).status_code==401
        headers={'X-Telegram-Bot-Api-Secret-Token':telegram_bot.webhook_secret(cfg)}
        assert c.post('/api/telegram/webhook',json=event,headers=headers).json()['status']=='queued'
        assert c.post('/api/telegram/webhook',json=event,headers=headers).json()['status']=='duplicate'
        assert max_bot.process_outbox(cfg,sender) is False
        assert telegram_bot.process_outbox(cfg,sender) is True
        assert len(sender.calls)==1 and sender.calls[0][1]['reply_markup']['inline_keyboard'][0][0]['web_app']['url']=='https://class.example.org'
        assert telegram_bot.process_outbox(cfg,sender) is False
        assert c.post('/api/telegram/webhook',json={'update_id':112,'message':[]},headers=headers).status_code in (200,422)
        with connect(cfg.database) as db:
            assert one(db,'SELECT external_id FROM bot_contacts')['external_id']=='telegram:123'
        event['update_id']=113
        c.post('/api/telegram/webhook',json=event,headers=headers)
        class Failure:
            def send(self,*args):raise RuntimeError('failure')
        for _ in range(3):
            with connect(cfg.database) as db:db.execute('UPDATE max_outbox SET available_at=0')
            telegram_bot.process_outbox(cfg,Failure())
        with connect(cfg.database) as db:assert one(db,"SELECT status FROM max_outbox WHERE id='telegram:update:113'")['status']=='failed'


def test_api_errors_redacted():
    cfg=Settings(telegram_token='synthetic-sensitive-token')
    with patch('httpx.Client.post',side_effect=RuntimeError(cfg.telegram_token)):
        with pytest.raises(RuntimeError) as exc:telegram_bot.TelegramAPI(cfg).request('getMe')
        assert cfg.telegram_token not in str(exc.value)
    assert cfg.telegram_token not in repr(cfg)

from tests.test_workflow import env
from tests.test_workflow import test_core_flow_and_immutable_original as core_flow
from tests.test_notifications import prepared,Transport
from apps.server.notifications import queue_due_reminders


def test_telegram_full_learning_cycle(env):
    c,app,cfg,headers=env
    cfg.telegram_enabled=True;cfg.telegram_token=TOKEN;cfg.public_base_url='https://class.example.org'
    with connect(cfg.database) as db:
        for i,who in enumerate(headers,1):db.execute('UPDATE users SET external_id=? WHERE id=?',('telegram:'+str(i),'demo-'+who))
    for i,who in enumerate(headers,1):
        response=c.post('/api/auth/telegram',json={'init_data':signed(TOKEN,i),'alias':'Тест','role':'learner'})
        assert response.status_code==200
        headers[who]={'Authorization':'Bearer '+response.json()['token']}
    core_flow((c,app,cfg,headers))
    assert c.get('/api/assignments/demo-assignment',headers=headers['outsider']).status_code==404


def test_telegram_reminder_channel_and_opt_out(env):
    c,app,cfg,headers=env
    prepared(env)
    cfg.telegram_enabled=True;cfg.telegram_token=TOKEN;cfg.public_base_url='https://class.example.org'
    cfg.max_outbound_enabled=False;cfg.max_bot_enabled=False;cfg.max_bot_id=0
    with connect(cfg.database) as db:
        db.execute("UPDATE users SET external_id='telegram:456' WHERE id='demo-learner'")
        db.execute("INSERT INTO bot_contacts VALUES('telegram:456',?)",(time.time(),))
    assert queue_due_reminders(cfg)==1
    transport=Transport()
    assert telegram_bot.process_outbox(cfg,transport)
    assert transport.sent[0][0]==456
    assert 'web_app' in transport.sent[0][1]['reply_markup']['inline_keyboard'][0][0]
    assert c.get('/api/notifications',headers=headers['learner']).json()['delivery_enabled'] is True
