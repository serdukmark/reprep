from concurrent.futures import ThreadPoolExecutor
from tests.test_workflow import env
from tests.test_notifications import prepared
from apps.server.notifications import queue_due_reminders


def test_independent_notification_changes_and_permissions(env):
    c,app,cfg,h=env
    for method in ('get','put','patch'):
        assert app.openapi()['paths']['/api/notifications'][method]['x-roles']==['tutor','learner']
    prepared(env)
    assert c.put('/api/notifications',headers=h['learner'],json={}).status_code==200
    with ThreadPoolExecutor(max_workers=2) as pool:
        results=list(pool.map(lambda body:c.patch('/api/notifications',headers=h['learner'],json=body),
            [{'lessons':True},{'assignments':True}]))
    assert all(r.status_code==200 for r in results)
    actual=c.get('/api/notifications',headers=h['learner']).json()
    assert actual['lessons'] is True and actual['assignments'] is True
    guardian=c.post('/api/auth/demo/guardian').json()['token']
    assert c.patch('/api/notifications',headers={'Authorization':'Bearer '+guardian},json={'lessons':True}).status_code==403
    assert c.patch('/api/notifications',json={'lessons':True}).status_code==401
    assert c.patch('/api/notifications',headers=h['learner-2'],json={'lessons':True}).status_code==422
    assert c.patch('/api/notifications',headers=h['tutor'],json={'assignments':True}).status_code==422
    for body in ({},{'user_id':'demo-learner-2'},{'lessons':None}):
        assert c.patch('/api/notifications',headers=h['learner'],json=body).status_code==422


def test_partial_opt_out_cancels_queued_delivery_without_disabling_other_preference(env):
    c,app,cfg,h=env
    prepared(env)
    assert queue_due_reminders(cfg)==1
    assert c.patch('/api/notifications',headers=h['learner'],json={'lessons':False}).status_code==200
    actual=c.get('/api/notifications',headers=h['learner']).json()
    assert actual['lessons'] is False and actual['assignments'] is True
    assert actual['deliveries']=={'cancelled':1}
