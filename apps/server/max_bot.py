"""MAX boundary. No network until explicit outbound enablement / setup --apply."""
import hashlib
import hmac
import json
import ssl
import time
from urllib.parse import urlsplit
import httpx
from .db import connect, one, dumps

API_ORIGIN = 'https://platform-api2.max.ru'


def public_origin(value):
    p = urlsplit(value)
    if (p.scheme != 'https' or not p.hostname or p.port is not None
            or p.username or p.password or p.query or p.fragment or p.path not in ('', '/')
            or p.hostname in ('localhost', '127.0.0.1', '::1') or len(value)>1024):
        raise ValueError('PUBLIC_BASE_URL must be an HTTPS origin without path or port')
    return value.rstrip('/')


def webhook_secret(cfg):
    # Independent purpose-bound secret: the bot token is never sent to our webhook.
    return cfg.max_webhook_secret or (hmac.new(cfg.bot_token.encode(), b'reprep-webhook-v1', hashlib.sha256).hexdigest() if cfg.bot_token else '')


def verify_webhook(headers, cfg):
    values = headers.getlist('x-max-bot-api-secret')
    expected = webhook_secret(cfg)
    return bool(expected and len(values)==1 and hmac.compare_digest(values[0].encode(), expected.encode()))


def reply_for(event, bot_id):
    """Return minimal reply only for direct start/help actions; never echo user text."""
    kind = event.get('update_type')
    if kind == 'bot_started':
        user = event.get('user') or {}
        recipient = user.get('user_id')
        if user.get('is_bot'): return None
        command = '/start'
    elif kind == 'message_created':
        message = event.get('message') or {}
        sender = message.get('sender') or {}
        if sender.get('is_bot') or (message.get('recipient') or {}).get('chat_type') != 'dialog':
            return None
        recipient = sender.get('user_id')
        command = ((message.get('body') or {}).get('text') or '').strip()
        if command not in ('/start','/help','/app'): return None
    else:
        return None
    if type(recipient) is not int or recipient<=0:
        raise ValueError('Invalid event user')
    text = ('reprep: задания, обратная связь и прогресс. Откройте учебное пространство кнопкой ниже. '
            'AI помогает с разбором, окончательное решение принимает преподаватель.')
    if command == '/help':
        text = ('Преподаватель назначает работу, ученик сохраняет и отправляет ответы. '
                'После AI-разбора преподаватель подтверждает или исправляет результат. '
                'Приглашение принимается в настройках. Работы сдавайте в мини-приложении, не в чате.')
    return recipient, {'text':text,'notify':False,'attachments':[{'type':'inline_keyboard','payload':{'buttons':[
        [{'type':'open_app','text':'Открыть reprep','contact_id':bot_id}]
    ]}}]}


def accept_event(cfg, event):
    if not isinstance(event,dict) or type(event.get('timestamp')) is not int:
        raise ValueError('Invalid update')
    stamp = event['timestamp']/1000
    if stamp > time.time()+60 or stamp < time.time()-9*3600:
        raise ValueError('Expired update')
    reply = reply_for(event,cfg.max_bot_id)
    if not reply: return 'ignored'
    recipient, body = reply
    event_id = hashlib.sha256(json.dumps(event,sort_keys=True,separators=(",",":"),ensure_ascii=False).encode()).hexdigest()
    # A raw event is never persisted; it may contain names, chat text and attachments.
    with connect(cfg.database) as c:
        if one(c,'SELECT id FROM max_outbox WHERE id=?',(event_id,)): return 'duplicate'
        count = one(c,'SELECT count(*) AS n FROM max_outbox WHERE recipient=? AND created>?',(recipient,time.time()-60))['n']
        if count>=10: return 'rate_limited'
        pending = one(c,"SELECT count(*) AS n FROM max_outbox WHERE status IN ('queued','sending')")['n']
        if pending>=100: raise RuntimeError('Queue full')
        c.execute('INSERT INTO max_outbox(id,recipient,body,created) VALUES(?,?,?,?)',(event_id,recipient,dumps(body),time.time()))
    return 'queued'


class MaxAPI:
    def __init__(self,cfg):
        self.cfg=cfg

    def request(self,method,path,**kwargs):
        context=ssl.create_default_context()
        if self.cfg.max_ca_bundle: context.load_verify_locations(self.cfg.max_ca_bundle)
        try:
            with httpx.Client(timeout=10,verify=context,follow_redirects=False) as c:
                r=c.request(method,API_ORIGIN+path,headers={'Authorization':self.cfg.bot_token},**kwargs)
                if r.status_code!=200: raise RuntimeError('MAX API rejected request')
                data=r.json()
                if not isinstance(data,dict) or data.get('success') is False or data.get('error'):
                    raise RuntimeError('MAX API rejected request')
                return data
        except Exception:
            raise RuntimeError('MAX transport failed; check configuration and trusted CA') from None

    def send(self,recipient,body):
        if not self.cfg.max_outbound_enabled: raise RuntimeError('MAX outbound disabled')
        result=self.request('POST','/messages',params={'user_id':recipient},json=body)
        if not result.get('message'): raise RuntimeError('MAX response missing message')


def process_outbox(cfg, transport=None):
    if not cfg.max_outbound_enabled: return False
    with connect(cfg.database) as c:
        item=one(c,"SELECT * FROM max_outbox WHERE status IN ('queued','sending') AND available_at<=? ORDER BY created LIMIT 1",(time.time(),))
        if not item: return False
        c.execute("UPDATE max_outbox SET status='sending',attempts=attempts+1,available_at=? WHERE id=?",(time.time()+30,item['id']))
    try:
        (transport or MaxAPI(cfg)).send(item['recipient'],json.loads(item['body']))
        state='sent'
    except Exception:
        state='failed' if item['attempts']>=2 else 'queued'
    with connect(cfg.database) as c:
        c.execute('UPDATE max_outbox SET status=?,available_at=? WHERE id=?',(state,time.time()+30,item['id']))
    return True
