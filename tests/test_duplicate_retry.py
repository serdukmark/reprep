from concurrent.futures import ThreadPoolExecutor
from tests.test_workflow import env


def test_duplicate_retry_is_scoped_and_keeps_one_copy(env):
    c, app, cfg, h = env
    path = '/api/assignments/demo-assignment/duplicate'
    body = {'client_id':'duplicate-request-123'}
    first = c.post(path, headers=h['tutor'], json=body)
    again = c.post(path, headers=h['tutor'], json=body)
    assert first.status_code == again.status_code == 200
    assert first.json()['id'] == again.json()['id']
    result = c.get('/api/assignments/'+first.json()['id'], headers=h['tutor']).json()
    assert result['status'] == 'draft' and result['submission'] is None
    assert c.get('/api/assignments/'+first.json()['id'], headers=h['learner']).status_code == 404
    assert c.post(path, headers=h['learner'], json=body).status_code == 403
    assert c.post(path, headers=h['outsider'], json=body).status_code == 404
    assert c.post(path, headers=h['tutor']).json()['id'] != first.json()['id']


def test_concurrent_duplicate_retry(env):
    c, app, cfg, h = env
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: c.post('/api/assignments/demo-assignment/duplicate',
            headers=h['tutor'], json={'client_id':'duplicate-concurrent-123'}), range(2)))
    assert all(r.status_code == 200 for r in results)
    assert len({r.json()['id'] for r in results}) == 1
