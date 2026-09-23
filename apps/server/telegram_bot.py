"""Telegram adapter: no raw updates stored, no token-bearing errors or logs."""
import hashlib
import hmac
import json
import logging
import time
import httpx
from .db import connect, one, dumps
from .max_bot import public_origin


def webhook_secret(cfg):
    return hmac.new(cfg.telegram_token.encode(), b'reprep-telegram-webhook-v1',hashlib.sha256).hexdigest() if cfg.telegram_token else ''


def verify_webhook(headers,cfg):
    values=headers.getlist('x-telegram-bot-api-secret-token')
    return bool(cfg.telegram_token and len(values)==1 and hmac.compare_digest(values[0].encode(),webhook_secret(cfg).encode()))


def reply_body(cfg,text=None):
    return {'text':text or 'RePrep: задания, разбор ошибок и прогресс. Откройте учебное пространство. Итоговую проверку подтверждает преподаватель.',
            'reply_markup':{'inline_keyboard':[[{'text':'Открыть RePrep','web_app':{'url':public_origin(cfg.public_base_url)}}]]}}


class TelegramAPI:
    def __init__(self,cfg):self.cfg=cfg
    def request(self,method,payload=None):
        # Bot API requires the token in its URL; never let HTTP debug logs record it.
        logging.getLogger('httpx').setLevel(logging.WARNING)
        logging.getLogger('httpcore').setLevel(logging.WARNING)
        if method not in ('getMe','setWebhook','getWebhookInfo','setChatMenuButton','sendMessage'):raise ValueError('Unsupported Telegram method')
        try:
            with httpx.Client(timeout=10,follow_redirects=False,trust_env=False) as client:
                response=client.post('https://api.telegram.org/bot'+self.cfg.telegram_token+'/'+method,json=payload or {})
                if response.status_code!=200:raise ValueError()
                data=response.json()
                if not isinstance(data,dict) or data.get('ok') is not True:raise ValueError()
                return data['result']
        except Exception:
            raise RuntimeError('Telegram API unavailable or rejected request') from None
    def send(self,recipient,body):
        if not self.cfg.telegram_enabled:raise RuntimeError('Telegram disabled')
        result=self.request('sendMessage',{'chat_id':recipient,**body})
        if not isinstance(result,dict) or not result.get('message_id'):raise RuntimeError('Telegram message rejected')


def accept_event(cfg,event):
    if not isinstance(event,dict) or type(event.get('update_id')) is not int or event['update_id']<0:raise ValueError('Invalid update')
    message=event.get('message') or {}
    sender=message.get('from') or {}; chat=message.get('chat') or {}
    if chat.get('type')!='private' or sender.get('is_bot'):return 'ignored'
    recipient=sender.get('id')
    if type(recipient) is not int or recipient<=0 or chat.get('id')!=recipient:raise ValueError('Invalid sender')
    stamp=message.get('date')
    if type(stamp) is not int or not -60<=time.time()-stamp<=86400:raise ValueError('Expired update')
    text=message.get('text','')
    if not isinstance(text,str):return 'ignored'
    command=text.split()[0] if text.split() else ''
    if command.split('@')[0] not in ('/start','/help','/app'):return 'ignored'
    key='telegram:update:'+str(event['update_id'])
    with connect(cfg.database) as c:
        c.execute('INSERT INTO bot_contacts VALUES(?,?) ON CONFLICT(external_id) DO UPDATE SET started=excluded.started',('telegram:'+str(recipient),time.time()))
        if one(c,'SELECT id FROM max_outbox WHERE id=?',(key,)):return 'duplicate'
        if one(c,"SELECT count(*) n FROM max_outbox WHERE id LIKE 'telegram:%' AND recipient=? AND created>?",(recipient,time.time()-60))['n']>=10:return 'rate_limited'
        if one(c,"SELECT count(*) n FROM max_outbox WHERE status IN ('queued','sending')")['n']>=100:raise RuntimeError('Queue full')
        c.execute('INSERT INTO max_outbox(id,recipient,body,created) VALUES(?,?,?,?)',(key,recipient,dumps(reply_body(cfg)),time.time()))
    return 'queued'


def process_outbox(cfg,transport=None):
    if not cfg.telegram_enabled:return False
    with connect(cfg.database) as c:
        item=one(c,"SELECT * FROM max_outbox WHERE id LIKE 'telegram:%' AND status IN ('queued','sending') AND available_at<=? ORDER BY created LIMIT 1",(time.time(),))
        if not item:return False
        if item['id'].startswith('telegram:reminder:'):
            from .notifications import valid_reminder
            if not valid_reminder(c,item['id'],time.time()):
                c.execute("UPDATE max_outbox SET status='cancelled' WHERE id=?",(item['id'],));return True
        c.execute("UPDATE max_outbox SET status='sending',attempts=attempts+1,available_at=? WHERE id=?",(time.time()+30,item['id']))
    try:
        (transport or TelegramAPI(cfg)).send(item['recipient'],json.loads(item['body']));state='sent'
    except Exception:state='failed' if item['attempts']>=2 else 'queued'
    with connect(cfg.database) as c:c.execute('UPDATE max_outbox SET status=?,available_at=? WHERE id=?',(state,time.time()+30,item['id']))
    return True


def setup(cfg):
    api=TelegramAPI(cfg)
    info=api.request('getMe')
    if info.get('username','').lower()!='maxfuckyoubot':raise ValueError('Unexpected Telegram bot')
    origin=public_origin(cfg.public_base_url)
    if api.request('setWebhook',{'url':origin+'/api/telegram/webhook','secret_token':webhook_secret(cfg),'allowed_updates':['message'],'max_connections':5}) is not True:raise ValueError('Webhook rejected')
    if api.request('setChatMenuButton',{'menu_button':{'type':'web_app','text':'Открыть RePrep','web_app':{'url':origin}}}) is not True:raise ValueError('Menu rejected')
    if api.request('getWebhookInfo').get('url')!=origin+'/api/telegram/webhook':raise ValueError('Webhook missing')


if __name__=='__main__':
    import sys
    from .config import Settings
    try:
        cfg=Settings.load()
        if sys.argv[1:]==['setup']:setup(cfg)
        elif sys.argv[1:]==['verify']:
            assert TelegramAPI(cfg).request('getWebhookInfo').get('url')==public_origin(cfg.public_base_url)+'/api/telegram/webhook'
        else:raise ValueError('Use setup or verify')
        print('Telegram webhook confirmed for @MaxFuckYouBot. No user messages sent by this check.')
    except Exception:
        raise SystemExit('Telegram configuration failed; no upstream response or credentials printed.')
