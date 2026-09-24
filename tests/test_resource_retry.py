from concurrent.futures import ThreadPoolExecutor
import pytest
from tests.test_workflow import env

CASES=[
 ('workspaces',{'title':'Пространство проверки'}),
 ('groups',{'title':'Группа проверки','relationship_ids':['demo-link']}),
 ('lessons',{'title':'Занятие проверки','relationship_id':'demo-link','starts_at':'2026-12-31T15:00:00Z'}),
 ('materials',{'title':'Материал проверки','relationship_id':'demo-link','url':'https://example.org/test'}),
]

@pytest.mark.parametrize('resource,payload',CASES)
def test_committed_resource_retry_and_conflict(env,resource,payload):
    c,app,cfg,h=env;body={**payload,'client_id':'synthetic-request-456'};path='/api/'+resource
    first=c.post(path,headers=h['tutor'],json=body)
    again=c.post(path,headers=h['tutor'],json=body)
    assert first.status_code in (200,201) and again.status_code==first.status_code
    assert first.json()['id']==again.json()['id']
    listed=c.get(path,headers=h['tutor']).json()
    assert len([x for x in listed if x['title']==payload['title']])==1
    assert all('client_id' not in x for x in listed)
    changed=c.post(path,headers=h['tutor'],json={**body,'title':'Другой заголовок'})
    assert changed.status_code==409
    assert c.post(path,headers=h['learner'],json=body).status_code==403
    if resource=='workspaces':
        other=c.post(path,headers=h['outsider'],json=body)
        assert other.status_code==201 and other.json()['id']!=first.json()['id']
    else:
        assert c.post(path,headers=h['outsider'],json=body).status_code==404
    legacy={k:v for k,v in body.items() if k!='client_id'}
    assert c.post(path,headers=h['tutor'],json=legacy).json()['id']!=first.json()['id']

@pytest.mark.parametrize('resource,payload',CASES)
def test_concurrent_resource_retry(env,resource,payload):
    c,app,cfg,h=env
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda _:c.post('/api/'+resource,headers=h['tutor'],json={**payload,'client_id':'synthetic-concurrent-789'}),range(2)))
    assert all(r.status_code in (200,201) for r in results)
    assert len({r.json()['id'] for r in results})==1
