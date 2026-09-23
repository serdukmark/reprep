"""Isolated synthetic browser audit. Never deploy this module or use production data."""
import time
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
        if 'AUD_AI_EMPTY' in str(context):return {}
        return GeneratedWork(title='Синтетическая генерация из материала',instructions='Тест интерфейса с детерминированным провайдером, не живой AI.',tasks=[{'id':f'q{i}','type':'numeric','prompt':'Сколько будет 2+3?','answer':'5','skill':'Сложение'} for i in range(context['count'])])

inner=create_app(Settings(database='artifacts/deep-audit/browser.sqlite3',environment='test',demo=True,bot_token='synthetic-max-test-token',public_base_url='https://audit.invalid',telegram_enabled=True,telegram_token='synthetic-tg-test-token',ai_daily_limit=10000),provider=AuditProvider())
class AuditApp:
    """Give each isolated test its own virtual client; production rate limits stay intact."""
    def __init__(self):self.client=0
    async def __call__(self,scope,receive,send):
        if scope['type']=='http':
            if scope['path']=='/__audit__/new-client' and scope['method']=='POST':
                self.client+=1
                await send({'type':'http.response.start','status':200,'headers':[(b'content-type',b'application/json')]})
                await send({'type':'http.response.body','body':b'{"ok":true}'})
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
