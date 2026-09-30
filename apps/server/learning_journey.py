"""Read-only punctuality facts. Submission timing is separate from skill evidence."""
import json
from datetime import datetime, timedelta, timezone
from itertools import groupby

from fastapi import Depends

from .db import rows


def _instant(value):
    """Reject absent/naive/malformed instants instead of guessing a timezone."""
    if not isinstance(value, str):
        raise ValueError('Missing timestamp')
    result = datetime.fromisoformat(value)
    if result.tzinfo is None or result.utcoffset() is None:
        raise ValueError('Missing timezone')
    return result.astimezone(timezone.utc)


def learning_journey(conn, relationship, at=None):
    at = (at or datetime.now(timezone.utc)).astimezone(timezone.utc)
    week_start = (at - timedelta(days=at.weekday())).replace(hour=0, minute=0, second=0, microsecond=0)
    week_end = week_start + timedelta(days=7)
    # Only the first attempt matters. Later corrections and AI/review latency cannot
    # award extra work, remove a punctual submission, or repair a missed deadline.
    work = rows(conn, '''SELECT a.data, s.id AS submission_id, s.submitted, s.attempt
        FROM assignments a
        LEFT JOIN submissions s ON s.id=(
            SELECT first.id FROM submissions first WHERE first.assignment_id=a.id
            ORDER BY first.attempt ASC LIMIT 1)
        WHERE a.relationship_id=? AND a.status='published' ''', (relationship,))
    facts = []
    excluded = insufficient = pending = 0
    week_total = week_submitted = week_on_time = 0
    for item in work:
        try:
            data = json.loads(item['data'])
            if not isinstance(data, dict) or 'due_at' not in data:
                raise ValueError('Missing deadline policy')
            if data['due_at'] is None:
                excluded += 1
                continue
            due = _instant(data['due_at'])
            submitted = None
            if item['submission_id'] is not None:
                if item['attempt'] != 1:
                    raise ValueError('Missing first attempt')
                submitted = _instant(item['submitted'])
                if submitted > at:
                    raise ValueError('Submission is in the future')
        except (ValueError, TypeError, OverflowError):
            insufficient += 1
            continue

        on_time = submitted is not None and submitted <= due
        # The exact deadline is inclusive: an unsent work is overdue only after it.
        state = 'on_time' if on_time else 'missed' if due < at else 'pending'
        pending += state == 'pending'
        facts.append((due, state))
        if week_start <= due < week_end:
            week_total += 1
            week_submitted += submitted is not None
            week_on_time += on_time

    count = 0
    decided = False
    for _, group in groupby(sorted(facts), key=lambda fact: fact[0]):
        states = [fact[1] for fact in group]
        decided |= any(state != 'pending' for state in states)
        # Equal deadlines are one group: a missed item resets it. IDs or query
        # ordering must not manufacture a streak after a simultaneous missed work.
        if 'missed' in states:
            count = 0
        else:
            count += states.count('on_time')
    data_status = 'insufficient_data' if insufficient else 'available' if facts else 'empty'
    return {
        'streak': {
            'count': count if decided and not insufficient else None,
            'eligible_count': len(facts),
            'pending_count': pending,
            'excluded_count': excluded,
        },
        'week': {
            'starts_at': week_start.isoformat(),
            'ends_at': week_end.isoformat(),
            'time_zone': 'UTC',
            'total': week_total,
            'submitted': week_submitted,
            'on_time': week_on_time,
            'complete': bool(week_total and week_submitted == week_total and not insufficient),
        },
        'calculated_at': at.isoformat(),
        'rules_version': 'v1',
        'data_status': data_status,
        'insufficient_count': insufficient,
    }


def install(app, cfg, user, db, relation, fail):
    @app.get('/api/relationships/{id_}/learning-journey')
    def journey(id_: str, u=Depends(user), c=Depends(db)):
        relation(c, id_, u)
        if not cfg.learning_journey_enabled:
            fail(404, 'LEARNING_JOURNEY_DISABLED', 'Учебный путь пока выключен')
        return learning_journey(c, id_)
