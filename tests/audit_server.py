"""Isolated synthetic browser audit. Never deploy this module or use production data."""
import time
import json
import asyncio
from apps.server.config import Settings
from apps.server.main import create_app
from apps.server.ai import LocalRules,OpenRouterAdapter
from apps.server.models import GeneratedWork

class AuditProvider(OpenRouterAdapter):
    def __init__(self):super().__init__('synthetic-no-network','fixture-not-live-ai')
    def analyze(self,context):
        text=str(context)
        if 'AUD_AI_UNAVAILABLE' in text:
            time.sleep(3)
            raise ConnectionError('Synthetic outage')
        if 'AUD_AI_EMPTY' in text:return {}
        if 'AUD_AI_GARBAGE' in text:return 'not structured output'
        if 'AUD_AI_SLOW' in text:time.sleep(4)
        return LocalRules().analyze(context)
    def answer_question(self,context):raise ConnectionError('Synthetic question outage')
    def generate_assignment(self,context):
        if 'AUD_AI_UNAVAILABLE' in str(context):raise ConnectionError('Synthetic generation outage')
        if 'AUD_AI_GARBAGE' in str(context):return 'not structured output'
        if 'AUD_AI_SLOW' in str(context):time.sleep(4)
        if 'AUD_AI_EMPTY' in str(context):return {}
        return GeneratedWork(title='Синтетическая генерация из материала',instructions='Тест интерфейса с детерминированным провайдером, не живой AI.',tasks=[{'id':f'q{i}','type':'numeric','prompt':'Сколько будет 2+3?','answer':'5','skill':'Сложение'} for i in range(context['count'])])

# The fixture must never send messages, even after synthetic notification opt-in.
import apps.server.main as server_main
server_main.process_outbox = lambda cfg: False
server_main.telegram_bot.process_outbox = lambda cfg: False
audit_settings=Settings(database='artifacts/deep-audit/browser.sqlite3',environment='test',demo=True,bot_token='synthetic-max-test-token',public_base_url='https://audit.invalid',telegram_enabled=True,telegram_token='synthetic-tg-test-token',ai_daily_limit=10000)
inner=create_app(audit_settings,provider=AuditProvider())
class AuditApp:
    """Give each isolated test its own virtual client; production rate limits stay intact."""
    def __init__(self):self.client=0
    async def __call__(self,scope,receive,send):
        if scope['type']=='http':
            if scope['path']=='/__audit__/new-client' and scope['method']=='POST':
                self.client+=1
                audit_settings.max_bot_enabled=False
                audit_settings.max_outbound_enabled=False
                await send({'type':'http.response.start','status':200,'headers':[(b'content-type',b'application/json')]})
                await send({'type':'http.response.body','body':b'{"ok":true}'})
                return
            if scope['path'] in ('/__audit__/identity/guardian','/__audit__/identity/learner') and scope['method']=='POST':
                from apps.server.db import connect
                from apps.server.auth import token_hash
                from apps.server.service import uid
                role=scope['path'].rsplit('/',1)[1]
                identity={'id':'audit-'+uid(),'role':role,'alias':'Другой родитель • аудит' if role=='guardian' else 'Новый ученик • аудит','demo':True}
                token='synthetic-session-'+uid()
                def identity_session():
                    with connect(audit_settings.database) as db:
                        db.execute('INSERT INTO users(id,role,alias,demo) VALUES(?,?,?,1)',(identity['id'],role,identity['alias']))
                        db.execute('INSERT INTO sessions VALUES(?,?,?)',(token_hash(token),identity['id'],time.time()+3600))
                await asyncio.to_thread(identity_session)
                await send({'type':'http.response.start','status':200,'headers':[(b'content-type',b'application/json')]})
                await send({'type':'http.response.body','body':json.dumps({'token':token,'user':identity}).encode()})
                return
            if scope['path']=='/__audit__/notification-contacts' and scope['method']=='POST':
                from apps.server.db import connect
                def contacts():
                    with connect(audit_settings.database) as db:
                        for role,external in (('tutor','900001'),('learner','900002')):
                            db.execute('UPDATE users SET external_id=? WHERE id=?',(external,'demo-'+role))
                            db.execute('INSERT OR REPLACE INTO bot_contacts VALUES(?,?)',(external,time.time()))
                await asyncio.to_thread(contacts)
                audit_settings.max_bot_enabled=True
                audit_settings.max_outbound_enabled=True
                audit_settings.max_bot_id=123
                await send({'type':'http.response.start','status':200,'headers':[(b'content-type',b'application/json')]})
                await send({'type':'http.response.body','body':b'{"ok":true,"delivery":"blocked_test_transport"}'})
                return
            if scope['path']=='/__audit__/expire-invitations' and scope['method']=='POST':
                from apps.server.db import connect
                def expire():
                    with connect('artifacts/deep-audit/browser.sqlite3') as db:
                        for table in ('invitations','guardian_access','workspace_invites'):
                            db.execute(f"UPDATE {table} SET expires=0 WHERE state='created'")
                await asyncio.to_thread(expire)
                await send({'type':'http.response.start','status':200,'headers':[(b'content-type',b'application/json')]})
                await send({'type':'http.response.body','body':b'{"ok":true}'})
                return
            # Translate only this loopback test origin; arbitrary origins remain rejected.
            headers=[(k,b'https://audit.invalid' if k==b'origin' and v==b'http://127.0.0.1:8017' else v) for k,v in scope.get('headers',[])]
            scope={**scope,'headers':headers,'client':('audit-'+str(self.client),0)}
        await inner(scope,receive,send)
app=AuditApp()
