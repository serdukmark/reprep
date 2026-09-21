from apps.server.db import initialize,connect,one
from apps.server.service import seed


def test_seed_repairs_partial_fixture_without_overwriting_existing_work(tmp_path):
    path=str(tmp_path/'seed.sqlite')
    initialize(path)
    with connect(path) as db:
        seed(db)
        original=one(db,'SELECT data FROM assignments WHERE id=?',('demo-assignment',))['data']
        changed=original.replace('Линейные уравнения: от шага к решению','Моя сохранённая работа')
        db.execute('UPDATE assignments SET data=? WHERE id=?',(changed,'demo-assignment'))
        db.execute('DELETE FROM assignments WHERE id=?',('demo-assignment-2',))
        seed(db)
        seed(db)
        assert one(db,'SELECT data FROM assignments WHERE id=?',('demo-assignment',))['data']==changed
        assert one(db,'SELECT count(*) n FROM assignments')['n']==2
        assert one(db,"SELECT count(*) n FROM users WHERE role='learner'")['n']==2
        assert one(db,'SELECT relationship_id FROM assignments WHERE id=?',('demo-assignment-2',))['relationship_id']=='demo-link-2'


def test_reset_after_extended_demo_preserves_non_demo_user(env):
    c,app,cfg,h=env
    with connect(cfg.database) as db:
        db.execute("INSERT INTO users VALUES('real-kept','999','tutor','Do not reset',0)")
    wid=c.post('/api/workspaces',headers=h['tutor'],json={'title':'Демо-ресурсы'}).json()['id']
    code=c.post('/api/workspaces/'+wid+'/invite',headers=h['tutor']).json()['token']
    c.post('/api/workspaces/accept',headers=h['outsider'],json={'token':code})
    tid=c.post('/api/workspaces/'+wid+'/templates',headers=h['tutor'],json={'assignment_id':'demo-assignment'}).json()['id']
    with connect(cfg.database) as db:db.execute("INSERT INTO relationships VALUES('demo-extra','demo-outsider','demo-learner-2','Физика')")
    assert c.post('/api/workspace-templates/'+tid+'/copy',headers=h['outsider'],json={'relationship_id':'demo-extra','client_id':'reset-test'}).status_code==201
    c.post('/api/groups',headers=h['tutor'],json={'title':'Демо','relationship_ids':['demo-link'],'revision':0})
    c.post('/api/relationships/demo-link/guardians',headers=h['tutor'])
    c.put('/api/relationships/demo-link/skill-graph',headers=h['tutor'],json={'revision':0,'skills':['Math'],'edges':[]})
    c.post('/api/account/deletion',headers=h['learner'],json={'confirm_alias':'Саша • демо'})
    assert c.post('/api/demo/reset',headers=h['tutor']).status_code==200
    with connect(cfg.database) as db:
        assert one(db,"SELECT alias FROM users WHERE id='real-kept'")['alias']=='Do not reset'
        assert one(db,'SELECT count(*) n FROM assignments')['n']==2
        assert db.execute('PRAGMA foreign_key_check').fetchall()==[]
        for table in ('workspaces','learning_groups','guardian_access','skill_graphs','deletion_requests'):
            assert one(db,f'SELECT count(*) n FROM {table}')['n']==0

from tests.test_workflow import env
