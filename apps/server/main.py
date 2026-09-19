import asyncio
import json
import logging
import secrets
import time
from contextlib import asynccontextmanager, suppress
from pathlib import Path
from fastapi import FastAPI, Depends, Request, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import ValidationError
from .config import Settings
from .db import initialize, connect, one, rows, dumps
from .auth import token_hash, verify_max
from .models import (AssignmentInput, DraftInput, ReviewInput, InviteInput, TokenInput,
                     MaxLogin, LessonInput, MaterialInput, ReportInput)
from .ai import ContextTooLarge, LocalRules, RemoteAdapter, OpenRouterAdapter, context_for, validate_analysis
from .max_bot import public_origin, verify_webhook, accept_event, process_outbox
from .service import uid, now, audit, seed, assignment_view, content_hash, progress

log = logging.getLogger('reprep')


def fail(status, code, message):
    raise HTTPException(status, {'code': code, 'message': message})


def create_app(settings=None, provider=None, run_worker=True):
    cfg = settings or Settings.load()
    if cfg.demo and cfg.environment not in ('development', 'test', 'demo'):
        raise RuntimeError('Demo access forbidden')
    if cfg.public_base_url:
        public_origin(cfg.public_base_url)
    if cfg.max_bot_enabled and (not cfg.bot_token or not cfg.public_base_url or cfg.max_bot_id<=0):
        raise RuntimeError('MAX bot requires token, public origin and bot ID; run setup check')
    if cfg.max_outbound_enabled and not cfg.max_bot_enabled:
        raise RuntimeError('MAX outbound requires bot enablement')
    engine = provider or (OpenRouterAdapter(cfg.openrouter_key, cfg.openrouter_model) if cfg.openrouter_key and cfg.openrouter_model else RemoteAdapter(cfg.ai_url, cfg.ai_key) if cfg.ai_url and cfg.ai_data_approved else LocalRules())

    def claim_job():
        with connect(cfg.database) as c:
            job = one(c, "SELECT * FROM submissions WHERE status='queued' OR (status='processing' AND lease_until<?) ORDER BY submitted LIMIT 1", (time.time(),))
            if not job:
                return None
            c.execute("UPDATE submissions SET status='processing',lease_until=? WHERE id=?", (time.time()+90, job['id']))
            a = one(c, 'SELECT * FROM assignments WHERE id=?', (job['assignment_id'],))
            history = rows(c, 'SELECT skill,correctness FROM evidence WHERE relationship_id=? ORDER BY created DESC LIMIT 100', (a['relationship_id'],))
            context = context_for(json.loads(a['data']), json.loads(job['answers']), history)
            learner = one(c, 'SELECT demo FROM users WHERE id=?', (job['learner_id'],))
            return job, context, learner

    def reserve_ai_call(job_id):
        with connect(cfg.database) as c:
            count = one(c, "SELECT count(*) AS n FROM audit WHERE event='external_ai_attempt' AND substr(created,1,10)=?", (now()[:10],))['n']
            if count >= cfg.ai_daily_limit:
                raise RuntimeError('Daily AI call limit reached')
            audit(c, None, 'external_ai_attempt', job_id)

    def finish_job(job_id, output):
        with connect(cfg.database) as c:
            # A tutor may have reviewed while the provider was running.
            c.execute("UPDATE submissions SET analysis=?,status='awaiting_review',lease_until=0 WHERE id=? AND status='processing'", (dumps(output), job_id))
            audit(c, None, 'analysis_completed', job_id)

    async def process_one():
        # SQLite may wait for a request transaction. Never block the event loop:
        # request dependency cleanup needs that loop to release its transaction.
        claimed = await asyncio.to_thread(claim_job)
        if not claimed:
            return False
        job, context, learner = claimed
        try:
            if len(json.dumps(context,ensure_ascii=False).encode())>60000:
                raise ContextTooLarge()
            if isinstance(engine, (OpenRouterAdapter, RemoteAdapter)):
                if not learner['demo'] and (cfg.synthetic_only or not cfg.ai_data_approved):
                    raise RuntimeError('Real learner data not approved for external AI')
                await asyncio.to_thread(reserve_ai_call, job['id'])
            output = await asyncio.wait_for(asyncio.to_thread(engine.analyze, context), timeout=60)
            output = validate_analysis(output.model_dump() if hasattr(output, 'model_dump') else output, context).model_dump()
        except ContextTooLarge:
            output = {'assessment_status':'output_invalid','engine':'unavailable','tasks':[],'requires_tutor_review':True,'failure_reason':'context_too_large'}
        except (ValidationError, ValueError):
            output = {'assessment_status': 'output_invalid', 'engine': 'unavailable', 'tasks': [], 'requires_tutor_review': True}
        except Exception:
            output = {'assessment_status': 'provider_unavailable', 'engine': 'unavailable', 'tasks': [], 'requires_tutor_review': True}
        await asyncio.to_thread(finish_job, job['id'], output)
        return True

    async def worker():
        while True:
            try:
                if not await process_one():
                    await asyncio.sleep(.3)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.error('worker_failure')
                await asyncio.sleep(1)

    async def bot_worker():
        while True:
            try:
                await asyncio.to_thread(process_outbox,cfg)
            except asyncio.CancelledError:
                raise
            except Exception:
                log.error('max_worker_failure')
            await asyncio.sleep(1)

    @asynccontextmanager
    async def lifespan(app):
        initialize(cfg.database)
        if cfg.demo:
            with connect(cfg.database) as c:
                seed(c)
        task = asyncio.create_task(worker()) if run_worker else None
        bot_task = asyncio.create_task(bot_worker()) if run_worker and cfg.max_outbound_enabled else None
        yield
        if bot_task:
            bot_task.cancel()
            with suppress(asyncio.CancelledError):
                await bot_task
        if task:
            task.cancel()
            with suppress(asyncio.CancelledError):
                await task

    app = FastAPI(title='reprep API', version='0.1.0', lifespan=lifespan, docs_url='/api/docs', openapi_url='/api/openapi.json')
    app.state.process_one = process_one
    app.state.settings = cfg
    login_limits = {}

    @app.middleware('http')
    async def security(request, call_next):
        reference = uid()
        request.state.reference = reference
        # Enforce same-origin writes; non-browser authenticated clients do not send Origin.
        if request.method not in ('GET', 'HEAD', 'OPTIONS'):
            origin = request.headers.get('origin')
            allowed = cfg.public_base_url or f"{request.url.scheme}://{request.headers.get('host')}"
            if origin and origin != allowed:
                return JSONResponse({'error': {'code': 'ORIGIN', 'message': 'Недопустимый источник запроса', 'reference_id': reference}}, status_code=403)
        length = request.headers.get('content-length', '0')
        if not length.isdigit() or int(length) > 150_000:
            return JSONResponse({'error': {'code': 'TOO_LARGE', 'message': 'Запрос слишком большой', 'reference_id': reference}}, status_code=413)
        if request.method in ('POST','PUT','PATCH'):
            body=bytearray()
            async for chunk in request.stream():
                body.extend(chunk)
                if len(body)>150_000:
                    return JSONResponse({'error':{'code':'TOO_LARGE','message':'Запрос слишком большой','reference_id':reference}},status_code=413)
            request._body=bytes(body)
        try:
            response = await call_next(request)
        except Exception:
            log.error('request_failed reference=%s', reference)
            response = JSONResponse({'error': {'code': 'INTERNAL', 'message': 'Не удалось выполнить действие. Повторите попытку.', 'reference_id': reference}}, status_code=500)
        response.headers['X-Request-ID'] = reference
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['Cache-Control'] = 'no-store' if request.url.path.startswith('/api') else 'no-cache'
        response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' https://st.max.ru; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://max.ru https://*.max.ru https://*.oneme.ru"
        if request.url.path == '/api/docs':
            response.headers['Content-Security-Policy'] = "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; img-src 'self' data: https://fastapi.tiangolo.com; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'self' https://max.ru https://*.max.ru https://*.oneme.ru"
        return response

    @app.exception_handler(HTTPException)
    async def http_error(request, exc):
        detail = exc.detail if isinstance(exc.detail, dict) else {'code': 'HTTP_ERROR', 'message': str(exc.detail)}
        return JSONResponse({'error': {**detail, 'reference_id': request.state.reference}}, status_code=exc.status_code)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, exc):
        fields = ['.'.join(str(x) for x in e['loc'][1:]) for e in exc.errors()]
        return JSONResponse({'error': {'code': 'VALIDATION', 'message': 'Проверьте заполнение полей: ' + ', '.join(fields), 'reference_id': request.state.reference}}, status_code=422)

    def db():
        with connect(cfg.database) as c:
            yield c

    def user(request: Request, c=Depends(db)):
        bearer = request.headers.get('authorization', '')
        if not bearer.startswith('Bearer '):
            fail(401, 'SESSION', 'Войдите в аккаунт')
        result = one(c, 'SELECT u.* FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>?', (token_hash(bearer[7:]), time.time()))
        if not result:
            fail(401, 'SESSION', 'Сессия завершилась. Войдите снова')
        return result

    def tutor(u):
        if u['role'] != 'tutor':
            fail(403, 'ROLE', 'Действие доступно преподавателю')

    def relation(c, relation_id, u):
        r = one(c, 'SELECT * FROM relationships WHERE id=?', (relation_id,))
        if not r or u['id'] not in (r['tutor_id'], r['learner_id']):
            fail(404, 'NOT_FOUND', 'Запись не найдена')
        return r

    def assignment(c, assignment_id, u):
        a = one(c, 'SELECT * FROM assignments WHERE id=?', (assignment_id,))
        if not a:
            fail(404, 'NOT_FOUND', 'Работа не найдена')
        relation(c, a['relationship_id'], u)
        if u['role'] == 'learner' and a['status'] == 'draft':
            fail(404, 'NOT_FOUND', 'Работа не найдена')
        return a

    def session(c, u):
        token = secrets.token_urlsafe(32)
        c.execute('DELETE FROM sessions WHERE expires<?', (time.time(),))
        c.execute('INSERT INTO sessions VALUES(?,?,?)', (token_hash(token), u['id'], time.time()+cfg.session_hours*3600))
        return {'token': token, 'user': {k: u[k] for k in ('id', 'role', 'alias', 'demo')}}

    def auth_rate(request):
        key = request.client.host if request.client else 'unknown'
        stamp, count = login_limits.get(key, (time.time(), 0))
        if time.time()-stamp > 60:
            stamp, count = time.time(), 0
        if count >= 30:
            fail(429, 'RATE_LIMIT', 'Слишком много попыток. Подождите минуту')
        if len(login_limits) > 10000:
            login_limits.clear()
        login_limits[key] = stamp, count+1

    @app.get('/api/health')
    def health(c=Depends(db)):
        c.execute('SELECT 1')
        return {'status': 'ok'}

    @app.get('/api/config')
    def config():
        return {'demo_enabled': cfg.demo, 'max_enabled': bool(cfg.bot_token), 'assessment': engine.model if isinstance(engine, OpenRouterAdapter) else 'approved_adapter' if isinstance(engine, RemoteAdapter) else 'local_rules', 'version': '0.1.0'}

    @app.post('/api/max/webhook')
    async def max_webhook(request: Request):
        if not cfg.max_bot_enabled:
            fail(404,'MAX_DISABLED','Бот не подключён')
        if not verify_webhook(request.headers,cfg):
            fail(401,'MAX_WEBHOOK_SECRET','Недопустимый запрос')
        try:
            result=await asyncio.to_thread(accept_event,cfg,await request.json())
        except (ValueError,TypeError,AttributeError):
            fail(422,'MAX_UPDATE','Некорректное событие')
        except RuntimeError:
            fail(503,'MAX_QUEUE','Повторите доставку позже')
        return {'ok':True,'status':result}

    @app.post('/api/auth/demo/{persona}')
    def demo_login(persona: str, request: Request, c=Depends(db)):
        auth_rate(request)
        if not cfg.demo or persona not in ('tutor', 'learner', 'learner-2', 'outsider'):
            fail(404, 'NOT_FOUND', 'Демо недоступно')
        return session(c, one(c, 'SELECT * FROM users WHERE id=?', ('demo-'+persona,)))

    @app.post('/api/auth/max')
    def max_login(body: MaxLogin, request: Request, c=Depends(db)):
        auth_rate(request)
        try:
            external_id = verify_max(body.init_data, cfg.bot_token)
        except (ValueError, KeyError, TypeError):
            fail(401, 'MAX_SIGNATURE', 'Откройте приложение заново из MAX')
        u = one(c, 'SELECT * FROM users WHERE external_id=?', (external_id,))
        if not u:
            id_ = uid()
            c.execute('INSERT INTO users(id,external_id,role,alias) VALUES(?,?,?,?)', (id_, external_id, body.role, body.alias))
            u = one(c, 'SELECT * FROM users WHERE id=?', (id_,))
        # Existing role is never changed by a client-supplied role.
        return session(c, u)

    @app.get('/api/me')
    def me(u=Depends(user)):
        return {k: u[k] for k in ('id', 'role', 'alias', 'demo')}

    @app.post('/api/logout')
    def logout(request: Request, u=Depends(user), c=Depends(db)):
        c.execute('DELETE FROM sessions WHERE token_hash=?', (token_hash(request.headers['authorization'][7:]),))
        return {'ok': True}

    @app.get('/api/relationships')
    def relationships(u=Depends(user), c=Depends(db)):
        return rows(c, '''SELECT r.*, t.alias AS tutor_alias,l.alias AS learner_alias FROM relationships r
            JOIN users t ON r.tutor_id=t.id JOIN users l ON r.learner_id=l.id
            WHERE r.tutor_id=? OR r.learner_id=? ORDER BY l.alias LIMIT 500''', (u['id'], u['id']))

    @app.post('/api/invitations')
    def invite(body: InviteInput, u=Depends(user), c=Depends(db)):
        tutor(u)
        token, id_ = secrets.token_urlsafe(24), uid()
        expires = time.time()+cfg.invite_hours*3600
        c.execute('INSERT INTO invitations(id,tutor_id,token_hash,subject,expires) VALUES(?,?,?,?,?)', (id_, u['id'], token_hash(token), body.subject, expires))
        audit(c, u['id'], 'invitation_created', id_)
        return {'id': id_, 'token': token, 'expires': expires}

    @app.get('/api/invitations')
    def invitations(u=Depends(user), c=Depends(db)):
        tutor(u)
        return rows(c, "SELECT id,subject,expires,CASE WHEN state='created' AND expires<? THEN 'expired' ELSE state END AS state FROM invitations WHERE tutor_id=? ORDER BY expires DESC LIMIT 100", (time.time(), u['id']))

    @app.post('/api/invitations/{id_}/revoke')
    def revoke(id_: str, u=Depends(user), c=Depends(db)):
        tutor(u)
        changed = c.execute("UPDATE invitations SET state='revoked' WHERE id=? AND tutor_id=? AND state='created'", (id_, u['id'])).rowcount
        if not changed:
            fail(409, 'INVITE_STATE', 'Приглашение уже использовано или недоступно')
        return {'ok': True}

    @app.post('/api/invitations/accept')
    def accept(body: TokenInput, u=Depends(user), c=Depends(db)):
        if u['role'] != 'learner':
            fail(403, 'ROLE', 'Приглашение предназначено ученику')
        inv = one(c, 'SELECT * FROM invitations WHERE token_hash=?', (token_hash(body.token),))
        if not inv or inv['state'] != 'created' or inv['expires'] < time.time():
            fail(410, 'INVITE_EXPIRED', 'Приглашение недействительно или уже использовано')
        owner = one(c, 'SELECT demo FROM users WHERE id=?', (inv['tutor_id'],))
        if owner['demo'] != u['demo']:
            fail(403, 'DEMO_BOUNDARY', 'Демо и реальные аккаунты разделены')
        c.execute('INSERT OR IGNORE INTO relationships VALUES(?,?,?,?)', (uid(), inv['tutor_id'], u['id'], inv['subject']))
        c.execute("UPDATE invitations SET state='accepted',accepted_by=? WHERE id=?", (u['id'], inv['id']))
        audit(c, u['id'], 'invitation_accepted', inv['id'])
        return {'ok': True}

    @app.get('/api/assignments')
    def assignments(u=Depends(user), c=Depends(db), offset: int = 0):
        if offset < 0:
            fail(422, 'OFFSET', 'Недопустимая страница')
        result = rows(c, '''SELECT a.*, l.alias AS learner_alias FROM assignments a JOIN relationships r ON r.id=a.relationship_id
            JOIN users l ON l.id=r.learner_id WHERE (a.tutor_id=? OR (r.learner_id=? AND a.status!='draft')) ORDER BY a.created DESC LIMIT 100 OFFSET ?''', (u['id'], u['id'], offset))
        output = []
        for a in result:
            data = json.loads(a['data'])
            s = one(c, 'SELECT id,status,attempt FROM submissions WHERE assignment_id=? ORDER BY attempt DESC LIMIT 1', (a['id'],))
            output.append({'id': a['id'], 'title': data['title'], 'due_at': data['due_at'], 'status': a['status'],
                'relationship_id': a['relationship_id'], 'learner_alias': a['learner_alias'], 'tasks_count': len(data['tasks']), 'submission': s})
        return output

    @app.post('/api/assignments', status_code=201)
    def create_assignment(body: AssignmentInput, u=Depends(user), c=Depends(db)):
        tutor(u)
        relation(c, body.relationship_id, u)
        id_ = uid()
        c.execute('INSERT INTO assignments(id,tutor_id,relationship_id,data,created) VALUES(?,?,?,?,?)', (id_, u['id'], body.relationship_id, body.model_dump_json(), now()))
        audit(c, u['id'], 'assignment_draft_created', id_)
        return assignment_view(one(c, 'SELECT * FROM assignments WHERE id=?', (id_,)), 'tutor')

    @app.put('/api/assignments/{id_}')
    def edit_assignment(id_: str, body: AssignmentInput, revision: int, u=Depends(user), c=Depends(db)):
        tutor(u)
        a = assignment(c, id_, u)
        if a['status'] != 'draft' or a['revision'] != revision:
            fail(409, 'VERSION_CONFLICT', 'Работа опубликована или изменена в другом окне')
        relation(c, body.relationship_id, u)
        c.execute('UPDATE assignments SET data=?,relationship_id=?,revision=revision+1 WHERE id=?', (body.model_dump_json(), body.relationship_id, id_))
        return assignment_view(one(c, 'SELECT * FROM assignments WHERE id=?', (id_,)), 'tutor')

    @app.post('/api/assignments/{id_}/publish')
    def publish(id_: str, u=Depends(user), c=Depends(db)):
        tutor(u)
        a = assignment(c, id_, u)
        if a['status'] == 'draft':
            c.execute("UPDATE assignments SET status='published' WHERE id=?", (id_,))
            audit(c, u['id'], 'assignment_published', id_)
        return {'ok': True}

    @app.post('/api/assignments/{id_}/duplicate')
    def duplicate(id_: str, u=Depends(user), c=Depends(db)):
        tutor(u)
        a = assignment(c, id_, u)
        data = json.loads(a['data']); data['title'] = (data['title'][:145]+' · копия')
        new_id = uid()
        c.execute('INSERT INTO assignments(id,tutor_id,relationship_id,data,created) VALUES(?,?,?,?,?)', (new_id, u['id'], a['relationship_id'], dumps(data), now()))
        return {'id': new_id}

    def submission_view(c, s, a, u):
        if not s:
            return None
        review = one(c, 'SELECT * FROM reviews WHERE submission_id=? ORDER BY created DESC LIMIT 1', (s['id'],))
        data = {'id': s['id'], 'attempt': s['attempt'], 'status': s['status'], 'answers': json.loads(s['answers']), 'submitted': s['submitted'], 'review': None, 'analysis': None}
        if review:
            data['review'] = {**json.loads(review['data']), 'action': review['action'], 'created': review['created']}
        if u['role'] == 'tutor':
            data['analysis'] = json.loads(s['analysis']) if s['analysis'] else None
        # Before review only explicitly tutor-written hints can reach a learner.
        if u['role'] == 'learner' and json.loads(a['data'])['feedback_policy'] == 'hints_first':
            data['hints'] = {t['id']: t.get('hint', '') for t in json.loads(a['data'])['tasks']}
        return data

    @app.get('/api/assignments/{id_}')
    def get_assignment(id_: str, u=Depends(user), c=Depends(db)):
        a = assignment(c, id_, u)
        s = one(c, 'SELECT * FROM submissions WHERE assignment_id=? ORDER BY attempt DESC LIMIT 1', (id_,))
        d = one(c, 'SELECT * FROM drafts WHERE assignment_id=?', (id_,))
        return {**assignment_view(a, u['role']), 'submission': submission_view(c, s, a, u),
                'draft': {'answers': json.loads(d['answers']), 'revision': d['revision']} if d else {'answers': {}, 'revision': 0}}

    @app.get('/api/assignments/{id_}/attempts')
    def attempts(id_: str, offset: int = 0, u=Depends(user), c=Depends(db)):
        assignment(c,id_,u)
        if offset<0:
            fail(422,'OFFSET','Некорректная страница истории')
        found=rows(c,'SELECT id,attempt,status,submitted FROM submissions WHERE assignment_id=? ORDER BY attempt DESC LIMIT 21 OFFSET ?',(id_,offset))
        return {'items':found[:20],'next_offset':offset+20 if len(found)>20 else None}

    def check_answers(a, answers):
        tasks = {t['id']: t for t in json.loads(a['data'])['tasks']}
        if not set(answers) <= set(tasks):
            fail(422, 'ANSWERS', 'Ответ относится к неизвестному заданию')
        for k, value in answers.items():
            if tasks[k]['type'] == 'single_choice' and value and value not in tasks[k]['options']:
                fail(422, 'ANSWERS', 'Выберите один из вариантов ответа')

    def latest(c, id_):
        return one(c, 'SELECT * FROM submissions WHERE assignment_id=? ORDER BY attempt DESC LIMIT 1', (id_,))

    def learner_only(u):
        if u['role'] != 'learner':
            fail(403, 'ROLE', 'Действие доступно ученику')

    @app.put('/api/assignments/{id_}/draft')
    def save_draft(id_: str, body: DraftInput, u=Depends(user), c=Depends(db)):
        learner_only(u)
        a = assignment(c, id_, u)
        check_answers(a, body.answers)
        s = latest(c, id_)
        if s and s['status'] != 'returned':
            fail(409, 'ALREADY_SUBMITTED', 'Работа уже отправлена')
        d = one(c, 'SELECT * FROM drafts WHERE assignment_id=? AND learner_id=?', (id_, u['id']))
        revision = d['revision'] if d else 0
        if body.revision != revision:
            fail(409, 'VERSION_CONFLICT', 'Ответы изменились в другом окне. Обновите работу перед сохранением')
        c.execute('INSERT INTO drafts VALUES(?,?,?,?) ON CONFLICT(assignment_id,learner_id) DO UPDATE SET revision=excluded.revision,answers=excluded.answers', (id_, u['id'], revision+1, dumps(body.answers)))
        return {'revision': revision+1, 'saved_at': now()}

    @app.post('/api/assignments/{id_}/submit')
    def submit(id_: str, body: DraftInput, u=Depends(user), c=Depends(db)):
        learner_only(u)
        a = assignment(c, id_, u)
        check_answers(a, body.answers)
        s = latest(c, id_)
        if s and s['status'] != 'returned':
            if s['checksum'] != content_hash(body.answers):
                fail(409, 'ALREADY_SUBMITTED', 'Уже отправлена другая версия ответов')
            return {'id': s['id'], 'status': s['status']}
        d = one(c, 'SELECT * FROM drafts WHERE assignment_id=?', (id_,))
        if body.revision != (d['revision'] if d else 0):
            fail(409, 'VERSION_CONFLICT', 'Ответы изменились в другом окне. Сначала обновите работу')
        tasks = json.loads(a['data'])['tasks']
        if any(not body.answers.get(t['id'], '').strip() for t in tasks):
            fail(422, 'INCOMPLETE', 'Ответьте на все задания перед отправкой')
        id_s = uid()
        c.execute('INSERT INTO submissions(id,assignment_id,learner_id,attempt,answers,checksum,submitted) VALUES(?,?,?,?,?,?,?)',
                  (id_s, id_, u['id'], s['attempt']+1 if s else 1, dumps(body.answers), content_hash(body.answers), now()))
        c.execute('DELETE FROM drafts WHERE assignment_id=?', (id_,))
        audit(c, u['id'], 'submission_completed', id_s)
        return {'id': id_s, 'status': 'queued'}

    def get_submission(c, id_, u):
        s = one(c, 'SELECT * FROM submissions WHERE id=?', (id_,))
        if not s:
            fail(404, 'NOT_FOUND', 'Работа не найдена')
        a = assignment(c, s['assignment_id'], u)
        return s, a

    @app.get('/api/submissions/{id_}')
    def submission_detail(id_: str, u=Depends(user), c=Depends(db)):
        s,a=get_submission(c,id_,u)
        return submission_view(c,s,a,u)

    @app.post('/api/submissions/{id_}/retry')
    def retry(id_: str, u=Depends(user), c=Depends(db)):
        tutor(u)
        s, a = get_submission(c, id_, u)
        analysis = json.loads(s['analysis']) if s['analysis'] else {}
        if s['status'] != 'awaiting_review' or s['retries'] >= 2 or analysis.get('assessment_status') not in ('provider_unavailable', 'output_invalid'):
            fail(409, 'RETRY', 'Повторная проверка сейчас недоступна. Можно проверить вручную')
        c.execute("UPDATE submissions SET status='queued',retries=retries+1 WHERE id=?", (id_,))
        return {'ok': True}

    @app.post('/api/submissions/{id_}/review')
    def review(id_: str, body: ReviewInput, u=Depends(user), c=Depends(db)):
        tutor(u)
        s, a = get_submission(c, id_, u)
        existing = one(c, 'SELECT * FROM reviews WHERE submission_id=?', (id_,))
        if existing:
            if existing['data'] == body.model_dump_json():
                return {'id': existing['id'], 'ok': True}
            fail(409, 'REVIEW_EXISTS', 'Решение уже сохранено. Обновите работу')
        tasks = {t['id']: t for t in json.loads(a['data'])['tasks']}
        if body.action in ('confirmed', 'corrected'):
            if len(body.tasks) != len(tasks) or {t.task_id for t in body.tasks} != set(tasks):
                fail(422, 'REVIEW_TASKS', 'Проверьте каждое задание')
        elif not body.note:
            fail(422, 'REVIEW_NOTE', 'Объясните ученику следующий шаг')
        if body.action == 'confirmed':
            assessment = json.loads(s['analysis']) if s['analysis'] else {}
            source = {t['task_id']: t for t in assessment.get('tasks', [])}
            if set(source) != set(tasks) or any(source[t.task_id]['correctness'] != t.correctness or source[t.task_id]['feedback_for_learner'] != t.feedback for t in body.tasks):
                fail(422, 'CONFIRM_CHANGED', 'Изменённый результат сохраните как исправление преподавателя')
        review_id = uid()
        c.execute('INSERT INTO reviews VALUES(?,?,?,?,?,?)', (review_id, id_, u['id'], body.action, body.model_dump_json(), now()))
        c.execute('UPDATE submissions SET status=? WHERE id=?', ('returned' if body.action == 'returned' else 'reviewed', id_))
        if body.action in ('confirmed', 'corrected'):
            for t in body.tasks:
                c.execute('INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?)', (uid(), a['relationship_id'], t.task_id, tasks[t.task_id]['skill'], t.correctness, review_id, id_, now()))
        audit(c, u['id'], 'tutor_review_'+body.action, id_)
        return {'id': review_id, 'ok': True}

    @app.get('/api/relationships/{id_}/progress')
    def get_progress(id_: str, u=Depends(user), c=Depends(db)):
        relation(c, id_, u)
        return progress(c, id_)

    @app.get('/api/relationships/{id_}/export')
    def export(id_: str, u=Depends(user), c=Depends(db)):
        r = relation(c, id_, u)
        return {'subject': r['subject'], 'exported_at': now(), 'progress': progress(c, id_)}

    def list_linked(c, table, u):
        result = rows(c, f'SELECT x.id,x.data,x.relationship_id FROM {table} x JOIN relationships r ON r.id=x.relationship_id WHERE r.tutor_id=? OR r.learner_id=? LIMIT 500', (u['id'], u['id']))
        output = [{**json.loads(r['data']), 'id': r['id']} for r in result]
        if u['role'] == 'learner':
            for item in output:
                item.pop('payment_status', None)
        return output

    @app.get('/api/lessons')
    def lessons(u=Depends(user), c=Depends(db)):
        return list_linked(c, 'lessons', u)

    @app.post('/api/lessons')
    def create_lesson(body: LessonInput, u=Depends(user), c=Depends(db)):
        tutor(u); relation(c, body.relationship_id, u)
        id_ = uid()
        c.execute('INSERT INTO lessons VALUES(?,?,?)', (id_, body.relationship_id, body.model_dump_json()))
        return {'id': id_}

    @app.put('/api/lessons/{id_}')
    def edit_lesson(id_: str, body: LessonInput, u=Depends(user), c=Depends(db)):
        tutor(u)
        old = one(c, 'SELECT * FROM lessons WHERE id=?', (id_,))
        if not old:
            fail(404, 'NOT_FOUND', 'Занятие не найдено')
        relation(c, old['relationship_id'], u); relation(c, body.relationship_id, u)
        c.execute('UPDATE lessons SET relationship_id=?,data=? WHERE id=?', (body.relationship_id, body.model_dump_json(), id_))
        return {'ok': True}

    @app.get('/api/materials')
    def materials(u=Depends(user), c=Depends(db)):
        return list_linked(c, 'materials', u)

    @app.post('/api/materials')
    def create_material(body: MaterialInput, u=Depends(user), c=Depends(db)):
        tutor(u); relation(c, body.relationship_id, u)
        id_ = uid()
        c.execute('INSERT INTO materials VALUES(?,?,?)', (id_, body.relationship_id, body.model_dump_json()))
        return {'id': id_}

    @app.post('/api/reports')
    def report(body: ReportInput, u=Depends(user), c=Depends(db)):
        if body.context_id:
            assignment(c, body.context_id, u)
        id_ = uid()
        c.execute('INSERT INTO reports VALUES(?,?,?,?,?,?)', (id_, u['id'], body.context_id, body.category, body.text, now()))
        return {'id': id_}

    @app.post('/api/demo/reset')
    def reset(u=Depends(user), c=Depends(db)):
        if not cfg.demo or u['id'] != 'demo-tutor':
            fail(403, 'DEMO_ONLY', 'Действие доступно только в демо преподавателя')
        # Delete only demo-owned records; never reset a database wholesale.
        cond = "SELECT id FROM assignments WHERE tutor_id IN (SELECT id FROM users WHERE demo=1)"
        subs = f'SELECT id FROM submissions WHERE assignment_id IN ({cond})'
        c.execute(f'DELETE FROM evidence WHERE submission_id IN ({subs})')
        c.execute(f'DELETE FROM reviews WHERE submission_id IN ({subs})')
        c.execute(f'DELETE FROM submissions WHERE assignment_id IN ({cond})')
        c.execute(f'DELETE FROM drafts WHERE assignment_id IN ({cond})')
        c.execute(f'DELETE FROM assignments WHERE id IN ({cond})')
        for table in ('lessons', 'materials'):
            c.execute(f'DELETE FROM {table} WHERE relationship_id IN (SELECT id FROM relationships WHERE tutor_id IN (SELECT id FROM users WHERE demo=1))')
        c.execute('DELETE FROM relationships WHERE tutor_id IN (SELECT id FROM users WHERE demo=1)')
        for table, field in [('invitations', 'tutor_id'), ('reports', 'user_id'), ('sessions', 'user_id')]:
            c.execute(f'DELETE FROM {table} WHERE {field} IN (SELECT id FROM users WHERE demo=1)')
        c.execute('DELETE FROM users WHERE demo=1')
        seed(c)
        return session(c, one(c, "SELECT * FROM users WHERE id='demo-tutor'"))

    dist = Path(__file__).resolve().parents[2] / 'dist'
    if (dist / 'assets').exists():
        app.mount('/assets', StaticFiles(directory=dist/'assets'), name='assets')
    @app.get('/')
    def index():
        if not (dist/'index.html').exists():
            return {'message': 'Run npm run dev, or npm run build to serve the client here.'}
        return FileResponse(dist/'index.html')

    return app


app = create_app()
