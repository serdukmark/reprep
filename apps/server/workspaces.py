"""Shared tutor templates; never grant access to private learner relationships."""
import json
import secrets
import time
from fastapi import Depends
from pydantic import Field
from .models import Model,TokenInput,AssignmentInput
from .auth import token_hash
from .db import one,rows,dumps
from .service import uid,now,audit


class WorkspaceInput(Model):
    title:str=Field(min_length=2,max_length=100)


class ShareTemplate(Model):
    assignment_id:str=Field(min_length=1,max_length=100)


class CopyTemplate(Model):
    relationship_id:str=Field(min_length=1,max_length=100)
    client_id:str=Field(min_length=8,max_length=100)


def install(app,user,db,tutor,relation,assignment,fail):
    def access(c,id_,u,owner=False):
        tutor(u)
        item=one(c,'SELECT w.* FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE w.id=? AND m.user_id=? AND m.active=1',(id_,u['id']))
        if not item or owner and item['owner_id']!=u['id']:fail(404,'WORKSPACE','Пространство недоступно')
        return item

    @app.get('/api/workspaces')
    def workspaces(u=Depends(user),c=Depends(db)):
        tutor(u)
        return rows(c,'SELECT w.id,w.title,w.owner_id FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id WHERE m.user_id=? AND m.active=1 ORDER BY w.created',(u['id'],))

    @app.post('/api/workspaces',status_code=201)
    def create_workspace(body:WorkspaceInput,u=Depends(user),c=Depends(db)):
        tutor(u)
        if one(c,'SELECT count(*) n FROM workspaces WHERE owner_id=?',(u['id'],))['n']>=10:fail(429,'LIMIT','Не более 10 пространств')
        wid=uid();c.execute('INSERT INTO workspaces VALUES(?,?,?,?)',(wid,u['id'],body.title,now()))
        c.execute('INSERT INTO workspace_members VALUES(?,?,1)',(wid,u['id']))
        audit(c,u['id'],'workspace_created',wid)
        return {'id':wid}

    @app.get('/api/workspaces/{id_}/members')
    def workspace_members(id_:str,u=Depends(user),c=Depends(db)):
        access(c,id_,u)
        return rows(c,'SELECT u.id,u.alias FROM workspace_members m JOIN users u ON u.id=m.user_id WHERE workspace_id=? AND active=1',(id_,))

    @app.post('/api/workspaces/{id_}/invite')
    def workspace_invite(id_:str,u=Depends(user),c=Depends(db)):
        access(c,id_,u,owner=True)
        if one(c,"SELECT count(*) n FROM workspace_invites WHERE workspace_id=? AND state='created' AND expires>?",(id_,time.time()))['n']>=20:fail(429,'LIMIT','Слишком много активных приглашений')
        iid=uid();token=secrets.token_urlsafe(32);expires=time.time()+72*3600
        c.execute('INSERT INTO workspace_invites(id,workspace_id,token_hash,expires) VALUES(?,?,?,?)',(iid,id_,token_hash(token),expires))
        return {'id':iid,'token':token,'expires':expires}

    @app.get('/api/workspaces/{id_}/invitations')
    def workspace_invitations(id_:str,u=Depends(user),c=Depends(db)):
        access(c,id_,u,owner=True)
        return rows(c,'SELECT id,state,expires FROM workspace_invites WHERE workspace_id=? ORDER BY expires DESC LIMIT 100',(id_,))

    @app.post('/api/workspaces/{id_}/invitations/{invite_id}/revoke')
    def workspace_revoke_invite(id_:str,invite_id:str,u=Depends(user),c=Depends(db)):
        access(c,id_,u,owner=True)
        item=one(c,'SELECT id FROM workspace_invites WHERE id=? AND workspace_id=?',(invite_id,id_))
        if not item:fail(404,'INVITE','Приглашение недоступно')
        c.execute("UPDATE workspace_invites SET state='revoked' WHERE id=?",(invite_id,))
        return {'ok':True}

    @app.post('/api/workspaces/accept')
    def workspace_accept(body:TokenInput,u=Depends(user),c=Depends(db)):
        tutor(u)
        item=one(c,'SELECT i.*,o.demo FROM workspace_invites i JOIN workspaces w ON w.id=i.workspace_id JOIN users o ON o.id=w.owner_id WHERE token_hash=?',(token_hash(body.token),))
        if not item or item['demo']!=u['demo'] or item['expires']<time.time() or item['state']=='revoked':fail(404,'INVITE','Приглашение недоступно')
        if item['state']=='accepted':
            if item['accepted_by']!=u['id']:fail(409,'INVITE','Приглашение уже принято')
            access(c,item['workspace_id'],u)
            return {'id':item['workspace_id']}
        if one(c,'SELECT count(*) n FROM workspace_members WHERE workspace_id=? AND active=1',(item['workspace_id'],))['n']>=20:fail(429,'LIMIT','В пространстве уже 20 участников')
        c.execute("UPDATE workspace_invites SET state='accepted',accepted_by=? WHERE id=?",(u['id'],item['id']))
        c.execute('INSERT INTO workspace_members VALUES(?,?,1) ON CONFLICT(workspace_id,user_id) DO UPDATE SET active=1',(item['workspace_id'],u['id']))
        audit(c,u['id'],'workspace_joined',item['workspace_id'])
        return {'id':item['workspace_id']}

    @app.post('/api/workspaces/{id_}/members/{member_id}/remove')
    def workspace_remove(id_:str,member_id:str,u=Depends(user),c=Depends(db)):
        w=access(c,id_,u)
        if member_id==w['owner_id'] or u['id'] not in (member_id,w['owner_id']):fail(403,'ROLE','Владелец исключает участников; участник может выйти сам')
        c.execute('UPDATE workspace_members SET active=0 WHERE workspace_id=? AND user_id=?',(id_,member_id))
        c.execute("UPDATE workspace_invites SET state='revoked' WHERE workspace_id=? AND accepted_by=?",(id_,member_id))
        audit(c,u['id'],'workspace_member_removed',id_)
        return {'ok':True}

    @app.get('/api/workspaces/{id_}/templates')
    def workspace_templates(id_:str,u=Depends(user),c=Depends(db)):
        access(c,id_,u)
        return [{'id':item['id'],'author_alias':item['alias'],'title':json.loads(item['data'])['title'],'tasks_count':len(json.loads(item['data'])['tasks'])} for item in rows(c,'SELECT t.id,t.data,u.alias FROM workspace_templates t JOIN users u ON u.id=t.author_id WHERE workspace_id=? ORDER BY t.created DESC LIMIT 200',(id_,))]

    @app.post('/api/workspaces/{id_}/templates',status_code=201)
    def share_workspace_template(id_:str,body:ShareTemplate,u=Depends(user),c=Depends(db)):
        access(c,id_,u);source=assignment(c,body.assignment_id,u)
        old=one(c,'SELECT id FROM workspace_templates WHERE workspace_id=? AND source_id=? AND source_revision=?',(id_,source['id'],source['revision']))
        if old:return old
        if one(c,'SELECT count(*) n FROM workspace_templates WHERE workspace_id=?',(id_,))['n']>=200:fail(429,'LIMIT','В библиотеке уже 200 шаблонов')
        raw=json.loads(source['data'])
        # No relationship, learner, files, answers, private discussion or schedule in shared data.
        data={k:raw[k] for k in ('title','instructions','tasks','feedback_policy')}
        tid=uid();c.execute('INSERT INTO workspace_templates VALUES(?,?,?,?,?,?,?)',(tid,id_,u['id'],source['id'],source['revision'],dumps(data),now()))
        audit(c,u['id'],'workspace_template_shared',tid)
        return {'id':tid}

    @app.post('/api/workspace-templates/{id_}/copy',status_code=201)
    def copy_workspace_template(id_:str,body:CopyTemplate,u=Depends(user),c=Depends(db)):
        item=one(c,'SELECT * FROM workspace_templates WHERE id=?',(id_,))
        if not item:fail(404,'TEMPLATE','Шаблон недоступен')
        access(c,item['workspace_id'],u);relation(c,body.relationship_id,u)
        old=one(c,'SELECT * FROM workspace_copies WHERE user_id=? AND client_id=?',(u['id'],body.client_id))
        if old:
            if old['template_id']!=id_ or old['relationship_id']!=body.relationship_id:fail(409,'REPLAY','Код запроса уже использован')
            return {'id':old['assignment_id']}
        data=AssignmentInput(relationship_id=body.relationship_id,**json.loads(item['data']))
        aid=uid();c.execute('INSERT INTO assignments(id,tutor_id,relationship_id,data,created) VALUES(?,?,?,?,?)',(aid,u['id'],body.relationship_id,data.model_dump_json(),now()))
        c.execute('INSERT INTO workspace_copies VALUES(?,?,?,?,?)',(u['id'],body.client_id,id_,body.relationship_id,aid))
        audit(c,u['id'],'workspace_template_copied',aid)
        return {'id':aid}
