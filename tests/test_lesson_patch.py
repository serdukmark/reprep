from concurrent.futures import ThreadPoolExecutor
from tests.test_workflow import env


def test_lesson_patch_preserves_independent_edits_and_permissions(env):
    c, app, cfg, h = env
    assert app.openapi()['paths']['/api/lessons/{id_}']['patch']['x-roles'] == ['tutor']
    original = c.get('/api/lessons', headers=h['tutor']).json()[0]
    path = '/api/lessons/' + original['id']
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda body: c.patch(path, headers=h['tutor'], json=body),
            [{'payment_status':'paid'}, {'status':'completed'}]))
    assert all(r.status_code == 200 for r in results)
    changed = c.get('/api/lessons', headers=h['tutor']).json()[0]
    assert changed['status'] == 'completed' and changed['payment_status'] == 'paid'
    for key in ('title', 'starts_at', 'duration', 'relationship_id'):
        assert changed[key] == original[key]
    assert c.patch(path, headers=h['learner'], json={'status':'cancelled'}).status_code == 403
    assert c.patch(path, headers=h['outsider'], json={'status':'cancelled'}).status_code == 404
    for body in ({}, {'status':None}, {'status':'invalid'}, {'title':'No'}, {'relationship_id':'demo-link-2'}):
        assert c.patch(path, headers=h['tutor'], json=body).status_code == 422
