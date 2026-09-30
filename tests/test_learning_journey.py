import json
from datetime import datetime, timezone

import pytest

from apps.server.config import Settings
from apps.server.db import connect
from apps.server.learning_journey import learning_journey
from tests.test_workflow import env, submit, review


AT = datetime(2026, 9, 30, 12, tzinfo=timezone.utc)
PATH = '/api/relationships/demo-link/learning-journey'


@pytest.fixture
def journey_env(env):
    c, app, cfg, h = env
    cfg.learning_journey_enabled = True
    with connect(cfg.database) as db:
        db.execute("UPDATE assignments SET status='draft'")
    return env


def add_work(db, id_, due, submitted=None, *, relationship='demo-link', status='published', attempt=1):
    db.execute('INSERT INTO assignments(id,tutor_id,relationship_id,status,data,created) VALUES(?,?,?,?,?,?)',
               (id_, 'demo-tutor', relationship, status,
                json.dumps({'due_at': due, 'title': 'PRIVATE_ASSIGNMENT', 'answer': 'SECRET_REFERENCE'}),
                '2026-09-01T00:00:00+00:00'))
    if submitted is not None:
        add_attempt(db, id_, submitted, attempt)


def add_attempt(db, id_, submitted, attempt):
    db.execute('INSERT INTO submissions(id,assignment_id,learner_id,attempt,answers,checksum,submitted) VALUES(?,?,?,?,?,?,?)',
               (f'{id_}-{attempt}', id_, 'demo-learner', attempt, '{"private":"LEARNER_ANSWER"}', 'checksum', submitted))


def test_feature_is_disabled_by_default_and_configuration_is_public(env, monkeypatch):
    c, app, cfg, h = env
    assert Settings().learning_journey_enabled is False
    assert c.get('/api/config').json()['learning_journey_enabled'] is False
    response = c.get(PATH, headers=h['learner'])
    assert response.status_code == 404
    assert response.json()['error']['code'] == 'LEARNING_JOURNEY_DISABLED'
    monkeypatch.setenv('LEARNING_JOURNEY_ENABLED', 'true')
    assert Settings.load().learning_journey_enabled is True
    monkeypatch.setenv('LEARNING_JOURNEY_ENABLED', 'false')
    assert Settings.load().learning_journey_enabled is False


def test_no_work_or_only_work_without_deadline_has_no_streak_or_medal(journey_env):
    c, app, cfg, h = journey_env
    with connect(cfg.database) as db:
        empty = learning_journey(db, 'demo-link', AT)
        assert empty['data_status'] == 'empty'
        assert empty['streak']['count'] is None
        assert empty['week']['total'] == 0 and empty['week']['complete'] is False
        add_work(db, 'no-deadline', None, '2026-09-29T10:00:00Z')
        result = learning_journey(db, 'demo-link', AT)
    assert result['streak'] == {'count': None, 'eligible_count': 0, 'pending_count': 0, 'excluded_count': 1}
    assert result['week']['complete'] is False


@pytest.mark.parametrize(('submitted', 'expected'), [
    ('2026-09-29T14:59:59.999999+03:00', 1),
    ('2026-09-29T15:00:00+03:00', 1),
    ('2026-09-29T12:00:00.000001Z', 0),
])
def test_deadline_is_inclusive_and_offsets_are_compared_as_instants(journey_env, submitted, expected):
    c, app, cfg, h = journey_env
    with connect(cfg.database) as db:
        add_work(db, 'work', '2026-09-29T12:00:00Z', submitted)
        result = learning_journey(db, 'demo-link', AT)
    assert result['streak']['count'] == expected
    assert result['week']['submitted'] == 1
    assert result['week']['on_time'] == expected
    assert result['week']['complete'] is True  # Submission, never a correctness claim.


def test_overdue_unsent_and_late_work_reset_in_deadline_order(journey_env):
    c, app, cfg, h = journey_env
    with connect(cfg.database) as db:
        add_work(db, 'old-success', '2026-09-20T12:00:00Z', '2026-09-19T12:00:00Z')
        add_work(db, 'missed', '2026-09-25T12:00:00Z')
        add_work(db, 'new-success', '2026-09-28T12:00:00Z', '2026-09-23T12:00:00Z')
        assert learning_journey(db, 'demo-link', AT)['streak']['count'] == 1
        add_work(db, 'latest-late', '2026-09-29T12:00:00Z', '2026-09-30T10:00:00Z')
        assert learning_journey(db, 'demo-link', AT)['streak']['count'] == 0


def test_future_pending_work_is_neutral_and_early_submissions_count(journey_env):
    c, app, cfg, h = journey_env
    with connect(cfg.database) as db:
        add_work(db, 'at-deadline', AT.isoformat())
        first = learning_journey(db, 'demo-link', AT)
        assert first['streak']['count'] is None and first['streak']['pending_count'] == 1
        add_work(db, 'already-done', '2026-10-02T12:00:00Z', '2026-09-29T12:00:00Z')
        add_work(db, 'future', '2026-10-03T12:00:00Z')
        result = learning_journey(db, 'demo-link', AT)
    assert result['streak']['count'] == 1
    assert result['streak']['pending_count'] == 2
    assert result['week']['total'] == 3 and result['week']['submitted'] == 1


def test_equal_deadlines_are_one_group_without_arbitrary_ordering(journey_env):
    c, app, cfg, h = journey_env
    with connect(cfg.database) as db:
        add_work(db, 'a-good', '2026-09-28T12:00:00Z', '2026-09-28T11:00:00Z')
        add_work(db, 'z-missed', '2026-09-28T12:00:00Z')
        assert learning_journey(db, 'demo-link', AT)['streak']['count'] == 0
        add_work(db, 'next', '2026-09-29T12:00:00Z', '2026-09-29T10:00:00Z')
        assert learning_journey(db, 'demo-link', AT)['streak']['count'] == 1


def test_corrections_never_add_to_or_erase_first_submission_punctuality(journey_env):
    c, app, cfg, h = journey_env
    with connect(cfg.database) as db:
        add_work(db, 'on-time', '2026-09-28T12:00:00Z', '2026-09-28T10:00:00Z')
        add_attempt(db, 'on-time', '2026-09-30T11:00:00Z', 2)
        assert learning_journey(db, 'demo-link', AT)['streak']['count'] == 1
        add_work(db, 'late', '2026-09-29T12:00:00Z', '2026-09-29T13:00:00Z')
        add_attempt(db, 'late', '2026-09-30T10:00:00Z', 2)
        result = learning_journey(db, 'demo-link', AT)
    assert result['streak']['count'] == 0
    assert result['week']['total'] == 2 and result['week']['submitted'] == 2
    assert result['week']['on_time'] == 1


def test_week_uses_utc_monday_and_excludes_next_monday(journey_env):
    c, app, cfg, h = journey_env
    with connect(cfg.database) as db:
        add_work(db, 'before', '2026-09-28T02:59:59+03:00', '2026-09-27T20:00:00Z')
        add_work(db, 'start', '2026-09-28T03:00:00+03:00', '2026-09-27T20:00:00Z')
        add_work(db, 'end', '2026-10-04T23:59:59.999999Z', '2026-09-29T20:00:00Z')
        add_work(db, 'next-week', '2026-10-05T00:00:00Z')
        result = learning_journey(db, 'demo-link', AT)
    assert result['week'] == {
        'starts_at': '2026-09-28T00:00:00+00:00', 'ends_at': '2026-10-05T00:00:00+00:00',
        'time_zone': 'UTC', 'total': 2, 'submitted': 2, 'on_time': 2, 'complete': True,
    }


@pytest.mark.parametrize(('due', 'submitted', 'attempt'), [
    ('not-a-date', None, 1),
    ('2026-09-29T12:00:00', None, 1),
    ('2026-09-29T12:00:00Z', 'bad', 1),
    ('2026-09-29T12:00:00Z', '2026-09-29T10:00:00', 1),
    ('2026-09-29T12:00:00Z', '2027-01-01T00:00:00Z', 1),
    ('2026-09-29T12:00:00Z', '2026-09-29T10:00:00Z', 2),
])
def test_insufficient_facts_never_produce_a_number_or_medal(journey_env, due, submitted, attempt):
    c, app, cfg, h = journey_env
    with connect(cfg.database) as db:
        add_work(db, 'good', '2026-09-28T12:00:00Z', '2026-09-28T11:00:00Z')
        add_work(db, 'corrupt', due, submitted, attempt=attempt)
        result = learning_journey(db, 'demo-link', AT)
    assert result['data_status'] == 'insufficient_data'
    assert result['insufficient_count'] == 1
    assert result['streak']['count'] is None
    assert result['week']['complete'] is False


@pytest.mark.parametrize('data', ['{}', '[]', 'not-json'])
def test_missing_deadline_policy_is_not_silently_treated_as_no_deadline(journey_env, data):
    c, app, cfg, h = journey_env
    with connect(cfg.database) as db:
        add_work(db, 'corrupt', None)
        db.execute('UPDATE assignments SET data=? WHERE id=?', (data, 'corrupt'))
        result = learning_journey(db, 'demo-link', AT)
    assert result['data_status'] == 'insufficient_data' and result['insufficient_count'] == 1


def test_all_published_history_is_counted_without_assignment_list_limit(journey_env):
    c, app, cfg, h = journey_env
    with connect(cfg.database) as db:
        for i in range(105):
            add_work(db, f'work-{i}', '2026-09-28T12:00:00Z', '2026-09-28T11:00:00Z')
        add_work(db, 'private-draft', '2026-09-20T12:00:00Z', status='draft')
        add_work(db, 'other-learner', '2026-09-20T12:00:00Z', relationship='demo-link-2')
        result = learning_journey(db, 'demo-link', AT)
    assert result['streak']['count'] == 105
    assert result['streak']['eligible_count'] == 105


def test_endpoint_is_authorized_and_contains_only_aggregate_facts(journey_env):
    c, app, cfg, h = journey_env
    with connect(cfg.database) as db:
        add_work(db, 'private', '2026-09-20T12:00:00Z', '2026-09-19T12:00:00Z')
    assert c.get('/api/config').json()['learning_journey_enabled'] is True
    assert c.get(PATH).status_code == 401
    for who in ('outsider', 'learner-2'):
        assert c.get(PATH, headers=h[who]).status_code == 404
    guardian = c.post('/api/auth/demo/guardian').json()['token']
    assert c.get(PATH, headers={'Authorization': 'Bearer ' + guardian}).status_code == 404
    for who in ('tutor', 'learner'):
        response = c.get(PATH, headers=h[who])
        assert response.status_code == 200
        data = response.json()
        assert data['streak']['count'] == 1
        assert set(data) == {'streak', 'week', 'calculated_at', 'rules_version', 'data_status', 'insufficient_count'}
        assert not any(secret in response.text for secret in ('PRIVATE_ASSIGNMENT', 'SECRET_REFERENCE', 'LEARNER_ANSWER', 'private'))


def test_openapi_declares_flag_nullable_counts_and_authorized_roles(journey_env):
    c, app, cfg, h = journey_env
    schema = app.openapi()
    operation = schema['paths']['/api/relationships/{id_}/learning-journey']['get']
    assert operation['x-roles'] == ['tutor', 'learner']
    assert operation['security'] == [{'SessionBearer': []}]
    assert operation['responses']['200']['content']['application/json']['schema'] == {'$ref': '#/components/schemas/LearningJourneyView'}
    view = schema['components']['schemas']['LearningJourneyView']
    actual = c.get(PATH, headers=h['learner']).json()
    assert set(view['required']) == set(actual)
    assert view['properties']['streak']['properties']['count'] == {'anyOf': [{'type': 'integer'}, {'type': 'null'}]}
    config = schema['paths']['/api/config']['get']['responses']['200']['content']['application/json']['schema']
    assert config['properties']['learning_journey_enabled'] == {'type': 'boolean'}


def test_real_submission_retry_return_and_review_leave_punctuality_unchanged(env):
    c, app, cfg, h = env
    cfg.learning_journey_enabled = True
    response = submit(c, h['learner'])
    sid = response.json()['id']
    assert response.status_code == 200
    assert submit(c, h['learner']).json()['id'] == sid
    assert c.get(PATH, headers=h['learner']).json()['streak']['count'] == 1
    assert review(c, h['tutor'], sid, action='returned').status_code == 200
    next_sid = submit(c, h['learner']).json()['id']
    assert next_sid != sid
    assert review(c, h['tutor'], next_sid, correctness='incorrect').status_code == 200
    assert c.get(PATH, headers=h['learner']).json()['streak']['count'] == 1
