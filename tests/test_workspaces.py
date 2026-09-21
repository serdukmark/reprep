from tests.test_workflow import env
from apps.server.db import connect,one


def test_shared_templates_copy_to_own_learner_without_opening_private_source(env):
    c,app,cfg,h=env
    wid=c.post('/api/workspaces',headers=h['tutor'],json={'title':'Коллеги'}).json()['id']
    invite=c.post('/api/workspaces/'+wid+'/invite',headers=h['tutor']).json()
    assert c.get('/api/workspaces/'+wid+'/templates',headers=h['outsider']).status_code==404
    assert c.post('/api/workspaces/accept',headers=h['learner'],json={'token':invite['token']}).status_code==403
    assert c.post('/api/workspaces/accept',headers=h['outsider'],json={'token':invite['token']}).status_code==200
    assert c.post('/api/workspaces/'+wid+'/invite',headers=h['outsider']).status_code==404
    shared=c.post('/api/workspaces/'+wid+'/templates',headers=h['tutor'],json={'assignment_id':'demo-assignment'})
    assert shared.status_code==201;tid=shared.json()['id']
    import json
    with connect(cfg.database) as db:
        snapshot=json.loads(one(db,'SELECT data FROM workspace_templates WHERE id=?',(tid,))['data'])
        assert set(snapshot)=={'title','instructions','tasks','feedback_policy'}
    assert c.post('/api/workspaces/'+wid+'/templates',headers=h['tutor'],json={'assignment_id':'demo-assignment'}).json()['id']==tid
    templates=c.get('/api/workspaces/'+wid+'/templates',headers=h['outsider']).json()
    assert set(templates[0])=={'id','title','author_alias','tasks_count'}
    assert c.get('/api/assignments/demo-assignment',headers=h['outsider']).status_code==404
    assert c.post('/api/workspaces/'+wid+'/templates',headers=h['outsider'],json={'assignment_id':'demo-assignment'}).status_code==404
    with connect(cfg.database) as db:db.execute("INSERT INTO relationships VALUES('colleague-link','demo-outsider','demo-learner-2','Math')")
    request={'relationship_id':'colleague-link','client_id':'copy-test-1'}
    copied=c.post('/api/workspace-templates/'+tid+'/copy',headers=h['outsider'],json=request)
    assert copied.status_code==201;aid=copied.json()['id']
    assert c.post('/api/workspace-templates/'+tid+'/copy',headers=h['outsider'],json=request).json()['id']==aid
    assert c.get('/api/assignments/'+aid,headers=h['learner-2']).status_code==404
    assignment=c.get('/api/assignments/'+aid,headers=h['outsider']).json()
    assert assignment['status']=='draft' and assignment['relationship_id']=='colleague-link'
    assert assignment['lesson_id']=='' and assignment['due_at'] is None
    assert c.post('/api/assignments/'+aid+'/publish',headers=h['outsider']).status_code==200
    assert c.get('/api/assignments/'+aid,headers=h['learner-2']).status_code==200
    assert c.get('/api/assignments/'+aid,headers=h['tutor']).status_code==404
    assert c.post('/api/workspaces/'+wid+'/members/demo-outsider/remove',headers=h['tutor']).status_code==200
    assert c.get('/api/workspaces/'+wid+'/templates',headers=h['outsider']).status_code==404
    assert c.post('/api/workspace-templates/'+tid+'/copy',headers=h['outsider'],json=request).status_code==404
    assert c.post('/api/workspaces/accept',headers=h['outsider'],json={'token':invite['token']}).status_code==404
    # A previously copied owned work stays owned; revocation cannot erase it.
    assert c.get('/api/assignments/'+aid,headers=h['outsider']).status_code==200


def test_workspace_role_invite_revoke_expiry_and_membership_boundaries(env):
    c,app,cfg,h=env
    wid=c.post('/api/workspaces',headers=h['tutor'],json={'title':'Методика'}).json()['id']
    assert c.get('/api/workspaces',headers=h['learner']).status_code==403
    invite=c.post('/api/workspaces/'+wid+'/invite',headers=h['tutor']).json()
    assert c.post('/api/workspaces/'+wid+'/invitations/'+invite['id']+'/revoke',headers=h['tutor']).status_code==200
    assert c.post('/api/workspaces/accept',headers=h['outsider'],json={'token':invite['token']}).status_code==404
    assert c.post('/api/workspaces/'+wid+'/members/demo-tutor/remove',headers=h['tutor']).status_code==403
    another=c.post('/api/workspaces/'+wid+'/invite',headers=h['tutor']).json()
    with connect(cfg.database) as db:db.execute('UPDATE workspace_invites SET expires=0 WHERE id=?',(another['id'],))
    assert c.post('/api/workspaces/accept',headers=h['outsider'],json={'token':another['token']}).status_code==404
    assert c.post('/api/demo/reset',headers=h['tutor']).status_code==200
    with connect(cfg.database) as db:assert one(db,'SELECT count(*) n FROM workspaces')['n']==0
