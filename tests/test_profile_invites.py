from tests.test_workflow import env


def test_profile_changes_only_own_alias(env):
    c,app,cfg,h=env
    before=c.get('/api/me',headers=h['learner']).json()
    r=c.put('/api/profile',headers=h['learner'],json={'alias':'Ученик пример'})
    assert r.status_code==200 and r.json()['alias']=='Ученик пример'
    after=c.get('/api/me',headers=h['learner']).json()
    assert after['alias']=='Ученик пример' and after['role']==before['role'] and after['id']==before['id']
    assert c.get('/api/me',headers=h['tutor']).json()['alias']!='Ученик пример'
    assert c.put('/api/profile',headers=h['learner'],json={'alias':'Имя','role':'tutor'}).status_code==422
    assert c.put('/api/profile',headers=h['learner'],json={'alias':''}).status_code==422


def test_invitation_preview_decline_and_accept(env):
    c,app,cfg,h=env
    def invitation():
        return c.post('/api/invitations',headers=h['tutor'],json={'subject':'Физика'}).json()
    inv=invitation();body={'token':inv['token']}
    for _ in range(2):
        r=c.post('/api/invitations/preview',headers=h['learner-2'],json=body)
        assert r.status_code==200 and r.json()['subject']=='Физика' and r.json()['tutor_alias']
    assert c.post('/api/invitations/preview',headers=h['tutor'],json=body).status_code==403
    assert c.post('/api/invitations/decline',headers=h['learner-2'],json=body).status_code==200
    assert c.post('/api/invitations/accept',headers=h['learner-2'],json=body).status_code==410
    assert c.post('/api/invitations/preview',headers=h['learner-2'],json=body).status_code==410
    assert next(i for i in c.get('/api/invitations',headers=h['tutor']).json() if i['id']==inv['id'])['state']=='declined'
    body={'token':invitation()['token']}
    assert c.post('/api/invitations/preview',headers=h['learner-2'],json=body).status_code==200
    assert c.post('/api/invitations/accept',headers=h['learner-2'],json=body).status_code==200
    assert c.post('/api/invitations/decline',headers=h['learner-2'],json=body).status_code==410
