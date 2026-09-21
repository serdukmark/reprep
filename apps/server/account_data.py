"""Authenticated own-data export and reversible deletion requests."""
import json
from pathlib import Path
import tempfile
from fastapi import Depends
from fastapi.responses import FileResponse
from starlette.background import BackgroundTask
from pydantic import Field
from .models import Model
from .db import one
from .service import assignment_view,progress,uid,now,audit


class DeletionRequest(Model):
    confirm_alias:str=Field(min_length=1,max_length=60)


def install(app,cfg,user,db,submission_view,file_data,learning_plan,fail):
    @app.get('/api/account/export')
    def export_account(u=Depends(user),c=Depends(db)):
        directory=Path(cfg.database).resolve().parent/'exports'
        directory.mkdir(mode=0o700,exist_ok=True)
        handle=tempfile.NamedTemporaryFile(mode='w',encoding='utf-8',prefix='account-',suffix='.json',dir=directory,delete=False)
        path=Path(handle.name)
        try:
            with handle as out:
                out.write('{"schema_version":"1","exported_at":'+json.dumps(now())+',"account":')
                out.write(json.dumps({k:u[k] for k in ('id','role','alias','demo','external_id')},ensure_ascii=False))
                def collection(name,sql,args=(),transform=None):
                    out.write(','+json.dumps(name)+':[');first=True
                    for record in c.execute(sql,args):
                        record=dict(record);value=transform(record) if transform else record
                        if value is None:continue
                        if not first:out.write(',')
                        first=False
                        for chunk in json.JSONEncoder(ensure_ascii=False).iterencode(value):out.write(chunk)
                    out.write(']')
                rscope='SELECT id FROM relationships WHERE tutor_id=? OR learner_id=?';rargs=(u['id'],u['id'])
                ascope=f"SELECT id FROM assignments WHERE relationship_id IN ({rscope}) AND (?='tutor' OR status!='draft')";aargs=(*rargs,u['role'])
                collection('relationships',f'SELECT id,tutor_id,learner_id,subject FROM relationships WHERE id IN ({rscope})',rargs)
                collection('assignments',f'SELECT * FROM assignments WHERE id IN ({ascope})',aargs,lambda a:assignment_view(a,u['role']))
                def submission(row):
                    source=one(c,'SELECT * FROM assignments WHERE id=?',(row['assignment_id'],))
                    return {'assignment_id':source['id'],**submission_view(c,row,source,u)}
                collection('submissions',f'SELECT * FROM submissions WHERE assignment_id IN ({ascope}) ORDER BY submitted',aargs,submission)
                if u['role']=='learner':
                    collection('drafts',f'SELECT * FROM drafts WHERE learner_id=? AND assignment_id IN ({ascope})',(u['id'],*aargs),lambda r:{'assignment_id':r['assignment_id'],'revision':r['revision'],'answers':json.loads(r['answers']),'attachments':file_data(c,'draft_files','assignment_id',r['assignment_id'])})
                def linked(row,kind):
                    value={'id':row['id'],**json.loads(row['data'])}
                    if u['role']!='tutor':value.pop('payment_status',None)
                    if kind=='materials' and value.get('assignment_id') and u['role']!='tutor' and not one(c,f'SELECT id FROM assignments WHERE id=? AND id IN ({ascope})',(value['assignment_id'],*aargs)):return None
                    return value
                for table in ('materials','lessons'):
                    collection(table,f'SELECT * FROM {table} WHERE relationship_id IN ({rscope})',rargs,lambda row,kind=table:linked(row,kind))
                collection('plans',rscope,rargs,lambda row:{'relationship_id':row['id'],**learning_plan(row['id'],u=u,c=c)})
                collection('progress',rscope,rargs,lambda row:{'relationship_id':row['id'],'skills':progress(c,row['id'])})
                collection('skill_graphs',f'SELECT * FROM skill_graphs WHERE relationship_id IN ({rscope})',rargs,lambda row:{'relationship_id':row['relationship_id'],'revision':row['revision'],**json.loads(row['data'])})
                collection('messages',f'SELECT id,assignment_id,user_id,text,created FROM messages WHERE assignment_id IN ({ascope})',aargs)
                def question(row):
                    row.pop('client_id',None);row.pop('lease_until',None)
                    row['draft']=json.loads(row['draft']) if row['draft'] and u['role']=='tutor' else None
                    if u['role']!='tutor' and row['status']!='published':row['response']=None
                    return row
                collection('questions',f'SELECT * FROM ai_questions WHERE assignment_id IN ({ascope})',aargs,question)
                collection('invitations','SELECT id,tutor_id,subject,expires,state,accepted_by FROM invitations WHERE tutor_id=? OR accepted_by=?',rargs)
                collection('guardian_access','SELECT id,relationship_id,tutor_id,guardian_id,state,expires,created FROM guardian_access WHERE tutor_id=? OR guardian_id=?',rargs)
                collection('groups','SELECT id,revision,data FROM learning_groups WHERE tutor_id=?',(u['id'],),lambda row:{'id':row['id'],'revision':row['revision'],**json.loads(row['data'])})
                collection('generation_requests','SELECT id,material_id,count,status,assignment_id,created FROM generations WHERE tutor_id=?',(u['id'],))
                collection('catalog_profile','SELECT revision,data FROM tutor_offers WHERE tutor_id=?',(u['id'],),lambda row:{'revision':row['revision'],**json.loads(row['data'])})
                collection('catalog_requests','SELECT id,learner_id,tutor_id,subject,message,price_rub,duration,status,reply,relationship_id,created FROM tutor_requests WHERE tutor_id=? OR learner_id=?',rargs)
                collection('workspace_memberships','SELECT w.id,w.title,w.owner_id,m.active FROM workspace_members m JOIN workspaces w ON w.id=m.workspace_id WHERE m.user_id=?',(u['id'],))
                collection('shared_templates','SELECT id,workspace_id,data,created FROM workspace_templates WHERE author_id=?',(u['id'],),lambda row:{'id':row['id'],'workspace_id':row['workspace_id'],'created':row['created'],**json.loads(row['data'])})
                collection('reports','SELECT id,context_id,category,text,created FROM reports WHERE user_id=?',(u['id'],))
                collection('audit','SELECT event,resource_id,created FROM audit WHERE actor_id=?',(u['id'],))
                collection('notification_settings','SELECT lessons,assignments FROM notification_settings WHERE user_id=?',(u['id'],))
                collection('reminder_deliveries','SELECT r.kind,r.due_at,o.status FROM reminder_deliveries r JOIN max_outbox o ON o.id=r.id WHERE r.user_id=?',(u['id'],))
                collection('deletion_requests','SELECT id,status,created FROM deletion_requests WHERE user_id=?',(u['id'],))
                out.write('}')
        except Exception:
            path.unlink(missing_ok=True);raise
        # The complete snapshot is on disk; do not hold a SQLite write lock during transfer.
        c.commit()
        return FileResponse(path,media_type='application/json',filename='reprep-my-data.json',background=BackgroundTask(path.unlink,missing_ok=True))

    @app.get('/api/account/deletion')
    def deletion_status(u=Depends(user),c=Depends(db)):
        return {'request':one(c,'SELECT id,status,created FROM deletion_requests WHERE user_id=?',(u['id'],)),
            'note':'Запрос можно отменить до обработки. Окончательное удаление выполняет владелец после согласования политики; сроки ещё не установлены.'}

    @app.post('/api/account/deletion',status_code=201)
    def request_deletion(body:DeletionRequest,u=Depends(user),c=Depends(db)):
        if body.confirm_alias!=u['alias']:fail(422,'CONFIRM','Введите текущее имя аккаунта для подтверждения')
        old=one(c,'SELECT * FROM deletion_requests WHERE user_id=?',(u['id'],))
        if old and old['status']=='requested':return {'id':old['id'],'status':'requested'}
        id_=uid();c.execute("INSERT INTO deletion_requests VALUES(?,?,'requested',?) ON CONFLICT(user_id) DO UPDATE SET id=excluded.id,status=excluded.status,created=excluded.created",(u['id'],id_,now()))
        audit(c,u['id'],'account_deletion_requested',id_)
        return {'id':id_,'status':'requested'}

    @app.post('/api/account/deletion/cancel')
    def cancel_deletion(u=Depends(user),c=Depends(db)):
        if not one(c,'SELECT id FROM deletion_requests WHERE user_id=?',(u['id'],)):fail(404,'REQUEST','Запроса нет')
        c.execute("UPDATE deletion_requests SET status='cancelled' WHERE user_id=?",(u['id'],));audit(c,u['id'],'account_deletion_cancelled',u['id'])
        return {'ok':True}
