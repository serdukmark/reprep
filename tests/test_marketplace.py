from tests.test_workflow import env
from apps.server.db import connect,one


def offer(revision=0,visible=True):
    return {'revision':revision,'visible':visible,'headline':'Подготовка к математике','description':'Синтетическая анкета для проверки каталога.','subjects':['Математика','Физика'],'price_rub':500,'duration':60}


def request_body(revision=1):
    return {'offer_revision':revision,'subject':'Физика','message':'Хочу разобрать движение.','client_id':'request-test-1'}


def test_opt_in_search_price_snapshot_and_consensual_relation(env):
    c,app,cfg,h=env
    assert c.get('/api/catalog',headers=h['learner']).json()['items']==[]
    assert c.put('/api/catalog/profile',headers=h['outsider'],json=offer(visible=False)).status_code==200
    assert c.get('/api/catalog',headers=h['learner']).json()['items']==[]
    assert c.put('/api/catalog/profile',headers=h['outsider'],json=offer(1)).status_code==200
    assert len(c.get('/api/catalog?q=ФИЗИКА&max_price=500',headers=h['learner']).json()['items'])==1
    assert c.get('/api/catalog?max_price=499',headers=h['learner']).json()['items']==[]
    body=request_body(2)
    assert c.post('/api/catalog/demo-outsider/requests',headers=h['learner'],json=request_body()).status_code==409
    rid=c.post('/api/catalog/demo-outsider/requests',headers=h['learner'],json=body).json()['id']
    assert c.post('/api/catalog/demo-outsider/requests',headers=h['learner'],json=body).json()['id']==rid
    assert c.get('/api/catalog/requests',headers=h['tutor']).json()==[]
    assert c.get('/api/catalog/requests',headers=h['learner-2']).json()==[]
    with connect(cfg.database) as db:assert one(db,"SELECT id FROM relationships WHERE tutor_id='demo-outsider' AND learner_id='demo-learner'") is None
    changed=offer(2);changed['price_rub']=900
    assert c.put('/api/catalog/profile',headers=h['outsider'],json=changed).status_code==200
    assert c.get('/api/catalog/requests',headers=h['learner']).json()[0]['price_rub']==500
    decision={'decision':'accepted','reply':'Давайте начнём с базовой задачи.'}
    assert c.post('/api/catalog/requests/'+rid+'/review',headers=h['tutor'],json=decision).status_code==404
    result=c.post('/api/catalog/requests/'+rid+'/review',headers=h['outsider'],json=decision)
    assert result.status_code==200 and result.json()['relationship_id']
    assert c.post('/api/catalog/requests/'+rid+'/review',headers=h['outsider'],json=decision).json()==result.json()
    assert c.post('/api/catalog/requests/'+rid+'/review',headers=h['outsider'],json={'decision':'declined'}).status_code==409
    assert any(r['id']==result.json()['relationship_id'] for r in c.get('/api/relationships',headers=h['learner']).json())
    assert c.get('/api/catalog/requests',headers=h['learner']).json()[0]['status']=='accepted'


def test_catalog_privacy_roles_decline_and_stale_profile(env):
    c,app,cfg,h=env
    assert c.put('/api/catalog/profile',headers=h['learner'],json=offer()).status_code==403
    assert c.put('/api/catalog/profile',headers=h['outsider'],json=offer()).status_code==200
    assert c.put('/api/catalog/profile',headers=h['outsider'],json=offer()).status_code==409
    assert c.post('/api/catalog/demo-outsider/requests',headers=h['tutor'],json=request_body()).status_code==403
    wrong=request_body();wrong['subject']='Другой предмет'
    assert c.post('/api/catalog/demo-outsider/requests',headers=h['learner'],json=wrong).status_code==404
    rid=c.post('/api/catalog/demo-outsider/requests',headers=h['learner'],json=request_body()).json()['id']
    declined=c.post('/api/catalog/requests/'+rid+'/review',headers=h['outsider'],json={'decision':'declined','reply':'Нет мест'})
    assert declined.json()['relationship_id'] is None
    with connect(cfg.database) as db:
        assert one(db,"SELECT id FROM relationships WHERE tutor_id='demo-outsider' AND learner_id='demo-learner'") is None
        db.execute("UPDATE users SET demo=0 WHERE id='demo-outsider'")
    assert c.get('/api/catalog',headers=h['learner']).json()['items']==[]
    body=request_body();body['client_id']='another-request'
    assert c.post('/api/catalog/demo-outsider/requests',headers=h['learner'],json=body).status_code==404
