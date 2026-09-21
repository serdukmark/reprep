import json,time
from datetime import datetime,timezone
from tests.test_workflow import env,submit
from apps.server.db import connect,one
from apps.server.notifications import queue_due_reminders
from apps.server.max_bot import accept_event,process_outbox

class Transport:
    def __init__(self,fail=False):self.sent=[];self.fail=fail
    def send(self,recipient,body):
        if self.fail:raise RuntimeError('synthetic offline failure')
        self.sent.append((recipient,body))

def prepared(env):
    c,app,cfg,h=env;cfg.max_bot_enabled=True;cfg.max_outbound_enabled=True;cfg.max_bot_id=123
    with connect(cfg.database) as db:db.execute("UPDATE users SET external_id='456' WHERE id='demo-learner'")
    accept_event(cfg,{'update_type':'bot_started','timestamp':int(time.time()*1000),'user':{'user_id':456}})
    transport=Transport();process_outbox(cfg,transport)
    due=datetime.fromtimestamp(time.time()+1800,timezone.utc).isoformat()
    body={'relationship_id':'demo-link','title':'PRIVATE LESSON NAME','starts_at':due,'duration':60}
    lid=c.post('/api/lessons',headers=h['tutor'],json=body).json()['id']
    assert c.put('/api/notifications',headers=h['learner'],json={'lessons':True,'assignments':True}).status_code==200
    return lid,body

def test_explicit_opt_in_contact_gate_and_disabled_delivery(env):
    c,app,cfg,h=env
    assert c.get('/api/notifications',headers=h['learner']).json()['bot_started'] is False
    assert c.put('/api/notifications',headers=h['learner'],json={'lessons':True}).status_code==422
    lid,body=prepared(env)
    cfg.max_outbound_enabled=False
    assert queue_due_reminders(cfg)==0
    cfg.max_outbound_enabled=True
    assert c.put('/api/notifications',headers=h['learner'],json={}).status_code==200
    assert queue_due_reminders(cfg)==0
    assert c.put('/api/notifications',headers=h['tutor'],json={'assignments':True}).status_code==422
    assert c.get('/api/notifications').status_code==401

def test_batched_once_and_minimal_payload(env):
    c,app,cfg,h=env;lid,body=prepared(env)
    c.post('/api/lessons',headers=h['tutor'],json=body)
    assert queue_due_reminders(cfg)==1
    assert queue_due_reminders(cfg)==0
    transport=Transport();assert process_outbox(cfg,transport)
    assert len(transport.sent)==1 and transport.sent[0][0]==456
    payload=transport.sent[0][1]
    assert 'PRIVATE' not in json.dumps(payload) and payload['notify'] is True
    assert payload['attachments'][0]['payload']['buttons'][0][0]['type']=='open_app'
    assert not process_outbox(cfg,transport)
    assert c.get('/api/notifications',headers=h['learner']).json()['deliveries']=={'sent':1}
    assert c.get('/api/notifications',headers=h['learner-2']).json()['deliveries']=={}

def test_cancelled_lesson_and_submitted_work_never_sent(env):
    c,app,cfg,h=env;lid,body=prepared(env)
    with connect(cfg.database) as db:
        row=one(db,"SELECT data FROM assignments WHERE id='demo-assignment'");data=json.loads(row['data']);data['due_at']=body['starts_at']
        db.execute("UPDATE assignments SET data=? WHERE id='demo-assignment'",(json.dumps(data),))
    assert queue_due_reminders(cfg)==2
    c.put('/api/lessons/'+lid,headers=h['tutor'],json={**body,'status':'cancelled'})
    assert submit(c,h['learner']).status_code==200
    transport=Transport()
    assert process_outbox(cfg,transport) and process_outbox(cfg,transport)
    assert transport.sent==[]
    assert c.get('/api/notifications',headers=h['learner']).json()['deliveries']=={'cancelled':2}

def test_opt_out_cancels_and_failure_is_visible_after_bounded_retries(env):
    c,app,cfg,h=env;prepared(env);assert queue_due_reminders(cfg)==1
    transport=Transport(fail=True)
    for i in range(3):
        with connect(cfg.database) as db:db.execute("UPDATE max_outbox SET available_at=0 WHERE id LIKE 'reminder:%'")
        assert process_outbox(cfg,transport)
    assert c.get('/api/notifications',headers=h['learner']).json()['deliveries']=={'failed':1}
    assert queue_due_reminders(cfg)==0 and not process_outbox(cfg,transport)
    with connect(cfg.database) as db:db.execute("UPDATE max_outbox SET status='queued' WHERE id LIKE 'reminder:%'")
    assert c.put('/api/notifications',headers=h['learner'],json={}).status_code==200
    assert c.get('/api/notifications',headers=h['learner']).json()['deliveries']=={'cancelled':1}
