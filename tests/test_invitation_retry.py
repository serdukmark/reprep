from tests.test_workflow import env
from apps.server.db import connect


def accepted(c, h):
    invite = c.post('/api/invitations', headers=h['tutor'], json={'subject': 'Повтор физики'}).json()
    body = {'token': invite['token']}
    assert c.post('/api/invitations/accept', headers=h['learner'], json=body).status_code == 200
    return invite, body


def test_same_learner_retries_accept_without_second_relationship(env):
    c, app, cfg, h = env
    invite, body = accepted(c, h)
    before = c.get('/api/relationships', headers=h['learner']).json()
    assert c.post('/api/invitations/accept', headers=h['learner'], json=body).status_code == 200
    assert c.get('/api/relationships', headers=h['learner']).json() == before
    # Starting a new invitation preview is still forbidden once consumed.
    assert c.post('/api/invitations/preview', headers=h['learner'], json=body).status_code == 410


def test_another_learner_cannot_replay_consumed_invitation(env):
    c, app, cfg, h = env
    invite, body = accepted(c, h)
    before = c.get('/api/relationships', headers=h['learner-2']).json()
    assert c.post('/api/invitations/accept', headers=h['learner-2'], json=body).status_code == 410
    assert c.get('/api/relationships', headers=h['learner-2']).json() == before


def test_expired_consumed_invitation_is_not_a_replay_bypass(env):
    c, app, cfg, h = env
    invite, body = accepted(c, h)
    with connect(cfg.database) as db:
        db.execute('UPDATE invitations SET expires=0 WHERE id=?', (invite['id'],))
    assert c.post('/api/invitations/accept', headers=h['learner'], json=body).status_code == 410
