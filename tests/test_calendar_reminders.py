from datetime import datetime,timedelta,timezone
from tests.test_workflow import env,submit
from apps.server.calendar_export import calendar


def test_calendar_utc_folding_and_no_field_injection():
    item={'id':'lesson-1','title':'Очень длинное название '*20+'\r\nATTENDEE:intruder@example.test',
          'starts_at':'2026-09-21T18:00:00+03:00','duration':60,'status':'cancelled','payment_status':'unpaid'}
    value=calendar([item],datetime(2026,9,21,tzinfo=timezone.utc))
    assert 'DTSTART:20260921T150000Z\r\n' in value and 'DTEND:20260921T160000Z\r\n' in value
    assert 'STATUS:CANCELLED' in value and 'payment' not in value
    assert '\r\nATTENDEE:' not in value
    assert all(len(line.encode())<=75 for line in value.split('\r\n'))
    assert '\\nATTENDEE:' in value.replace('\r\n ','')
    assert value.count('BEGIN:VEVENT')==value.count('END:VEVENT')==1


def test_private_calendar_and_in_app_reminders(env):
    c,app,cfg,h=env
    start=(datetime.now(timezone.utc)+timedelta(hours=2)).isoformat()
    body={'relationship_id':'demo-link','title':'Скоро занятие','starts_at':start,'duration':60,'payment_status':'unpaid'}
    lid=c.post('/api/lessons',headers=h['tutor'],json=body).json()['id']
    other=c.post('/api/lessons',headers=h['tutor'],json={**body,'relationship_id':'demo-link-2','title':'Чужое занятие'}).json()['id']
    export=c.get('/api/calendar',headers=h['learner']).json()['content']
    assert lid in export and other not in export and 'unpaid' not in export
    assert 'BEGIN:VEVENT' not in c.get('/api/calendar',headers=h['outsider']).json()['content']
    source=c.get('/api/assignments/demo-assignment',headers=h['tutor']).json()
    assignment={k:source[k] for k in ('relationship_id','title','tasks')}
    assignment['due_at']=(datetime.now(timezone.utc)-timedelta(hours=1)).isoformat()
    aid=c.post('/api/assignments',headers=h['tutor'],json=assignment).json()['id']
    assert all(i['resource_id']!=aid for i in c.get('/api/reminders',headers=h['learner']).json()['items'])
    c.post('/api/assignments/'+aid+'/publish',headers=h['tutor'])
    view=c.get('/api/reminders',headers=h['learner']).json()
    assert view['channel']=='in_app'
    assert any(i['resource_id']==lid for i in view['items'])
    assert not any(i['resource_id']==other for i in view['items'])
    assert any(i['resource_id']==aid and i['kind']=='overdue' for i in view['items'])
    submit(c,h['learner'],aid)
    c.put('/api/lessons/'+lid,headers=h['tutor'],json={**body,'status':'cancelled'})
    assert all(i['resource_id'] not in (lid,aid) for i in c.get('/api/reminders',headers=h['learner']).json()['items'])
