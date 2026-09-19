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
