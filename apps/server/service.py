import hashlib
import json
import secrets
from datetime import datetime, timezone, timedelta
from .db import one, rows, dumps


def uid():
    return secrets.token_hex(12)


def now():
    return datetime.now(timezone.utc).isoformat()


def audit(conn, actor, event, resource):
    conn.execute('INSERT INTO audit VALUES(?,?,?,?,?)', (uid(), actor, event, resource, now()))


def content_hash(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()


def seed(conn):
    conn.executemany('INSERT OR IGNORE INTO users(id,role,alias,demo) VALUES(?,?,?,1)', [
        ('demo-guardian', 'guardian', 'Родитель • демо'), ('demo-tutor', 'tutor', 'Алекс • демо'), ('demo-learner', 'learner', 'Саша • демо'),
        ('demo-learner-2', 'learner', 'Женя • демо'), ('demo-outsider', 'tutor', 'Другой репетитор • демо')])
    conn.executemany('INSERT OR IGNORE INTO relationships VALUES(?,?,?,?)', [
        ('demo-link', 'demo-tutor', 'demo-learner', 'Математика · ЕГЭ'),
        ('demo-link-2', 'demo-tutor', 'demo-learner-2', 'Математика · ЕГЭ')])
    data = {'relationship_id': 'demo-link', 'title': 'Линейные уравнения: от шага к решению',
        'instructions': 'Решите три коротких задания. Можно сохранять ответы и возвращаться к работе.',
        'due_at': (datetime.now(timezone.utc) + timedelta(days=2)).isoformat(), 'feedback_policy': 'hints_first',
        'tasks': [
            {'id': 'linear', 'type': 'numeric', 'prompt': 'Решите уравнение: 3x + 7 = 22. Чему равен x?',
             'answer': '5', 'rubric': 'Вычесть 7 из обеих частей, разделить на 3.', 'skill': 'Линейные уравнения',
             'options': [], 'hint': 'Сначала оставьте слагаемое с x в одной части уравнения.'},
            {'id': 'fraction', 'type': 'single_choice', 'prompt': 'Какое число равно ¾?',
             'answer': '0,75', 'rubric': '', 'skill': 'Дроби', 'options': ['0,25', '0,5', '0,75', '1,25'],
             'hint': 'Дробная черта означает деление числителя на знаменатель.'},
            {'id': 'reason', 'type': 'short_text', 'prompt': 'Почему при решении уравнения можно вычесть одно число из обеих частей?',
             'answer': '', 'rubric': 'Ученик объясняет сохранение равенства при одинаковой операции с обеими частями.',
             'skill': 'Обоснование решения', 'options': [], 'hint': 'Представьте две чаши весов в равновесии.'}]}
    conn.execute('INSERT OR IGNORE INTO assignments(id,tutor_id,relationship_id,status,data,created) VALUES(?,?,?,?,?,?)',
                 ('demo-assignment', 'demo-tutor', 'demo-link', 'published', dumps(data), now()))
    second = {**data, 'relationship_id':'demo-link-2', 'title':'Дроби и уравнения: самостоятельная работа'}
    conn.execute('INSERT OR IGNORE INTO assignments(id,tutor_id,relationship_id,status,data,created) VALUES(?,?,?,?,?,?)',
                 ('demo-assignment-2', 'demo-tutor', 'demo-link-2', 'published', dumps(second), now()))
    lesson = {'relationship_id': 'demo-link', 'title': 'Разбираем уравнения',
              'starts_at': (datetime.now(timezone.utc) + timedelta(days=1)).replace(hour=15, minute=0).isoformat(),
              'duration': 60, 'payment_status': 'unknown'}
    conn.execute('INSERT OR IGNORE INTO lessons VALUES(?,?,?)', ('demo-lesson', 'demo-link', dumps(lesson)))


def assignment_view(row, role):
    data = json.loads(row['data'])
    if role == 'learner':
        data['tasks'] = [{k: t[k] for k in ('id', 'type', 'prompt', 'options', 'skill')} for t in data['tasks']]
    return {**data, 'id': row['id'], 'status': row['status'], 'revision': row['revision'], 'created': row['created']}


def progress(conn, relationship):
    evidence = rows(conn, '''SELECT e.*, r.action AS review_action, a.data AS assignment_data FROM evidence e
        JOIN reviews r ON r.id=e.review_id JOIN submissions s ON s.id=e.submission_id JOIN assignments a ON a.id=s.assignment_id
        WHERE e.relationship_id=? ORDER BY e.created DESC,e.id DESC''', (relationship,))
    skills = {}
    for e in evidence:
        e['assignment_title'] = json.loads(e.pop('assignment_data'))['title']
        entry = skills.setdefault(e['skill'], {'skill': e['skill'], 'correct': 0, 'total': 0, 'latest': e['correctness'], 'evidence': []})
        if e['correctness'] != 'unknown':
            entry['total'] += 1
            entry['correct'] += e['correctness'] == 'correct'
        entry['evidence'].append(e)
    return list(skills.values())
