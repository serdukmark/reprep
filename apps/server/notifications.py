"""Explicitly opted-in reminders; queue only with MAX outbound enabled."""
import hashlib
import json
import time
from datetime import datetime
from fastapi import Depends
from .models import Model
from .db import connect,one,rows,dumps
from .max_bot import reply_for


class NotificationInput(Model):
    lessons:bool=False
    assignments:bool=False


def preferences(c,user_id):
    return one(c,'SELECT lessons,assignments FROM notification_settings WHERE user_id=?',(user_id,)) or {'lessons':0,'assignments':0}


def slots(c,user,prefs,stamp):
    result=set()
    if prefs['lessons']:
        for row in rows(c,'SELECT l.data FROM lessons l JOIN relationships r ON r.id=l.relationship_id WHERE r.tutor_id=? OR r.learner_id=? LIMIT 1000',(user['id'],user['id'])):
            data=json.loads(row['data']);due=int(datetime.fromisoformat(data['starts_at']).timestamp())
            if data.get('status','scheduled')=='scheduled' and 0<=due-stamp<=3600:result.add(('lesson',due))
    if prefs['assignments'] and user['role']=='learner':
        for row in rows(c,"SELECT a.id,a.data FROM assignments a JOIN relationships r ON r.id=a.relationship_id WHERE r.learner_id=? AND a.status='published' ORDER BY a.created DESC LIMIT 1000",(user['id'],)):
            data=json.loads(row['data'])
            if not data.get('due_at'):continue
            due=int(datetime.fromisoformat(data['due_at']).timestamp())
            last=one(c,'SELECT status FROM submissions WHERE assignment_id=? ORDER BY attempt DESC LIMIT 1',(row['id'],))
            if 0<=due-stamp<=86400 and (not last or last['status']=='returned'):result.add(('assignment',due))
    return result


def valid_reminder(c,id_,stamp):
    reminder=one(c,'SELECT * FROM reminder_deliveries WHERE id=?',(id_,))
    if not reminder:return False
    user=one(c,'SELECT * FROM users WHERE id=?',(reminder['user_id'],))
    if not user or not user['external_id'] or not one(c,'SELECT external_id FROM bot_contacts WHERE external_id=?',(user['external_id'],)):return False
    return (reminder['kind'],reminder['due_at']) in slots(c,user,preferences(c,user['id']),stamp)


def queue_due_reminders(cfg,stamp=None):
    if not (cfg.max_bot_enabled and cfg.max_outbound_enabled):return 0
    stamp=time.time() if stamp is None else stamp;queued=0
    with connect(cfg.database) as c:
        pending=one(c,"SELECT count(*) n FROM max_outbox WHERE status IN ('queued','sending')")['n']
        users=rows(c,'SELECT u.* FROM users u JOIN notification_settings n ON n.user_id=u.id JOIN bot_contacts b ON b.external_id=u.external_id WHERE n.lessons=1 OR n.assignments=1 LIMIT 1000')
        for user in users:
            for kind,due in sorted(slots(c,user,preferences(c,user['id']),stamp)):
                key='reminder:'+hashlib.sha256(f"{user['id']}|{kind}|{due}".encode()).hexdigest()
                if one(c,'SELECT id FROM reminder_deliveries WHERE id=?',(key,)):continue
                if pending>=100:return queued
                try:recipient=int(user['external_id'])
                except (ValueError,TypeError):continue
                if recipient<=0:continue
                generated=reply_for({'update_type':'bot_started','user':{'user_id':recipient}},cfg.max_bot_id)
                if not generated:continue
                _,body=generated
                body['notify']=True
                body['text']='Скоро занятие. Посмотрите ближайшие занятия в расписании reprep.' if kind=='lesson' else 'Приближается срок выполнения работы. Откройте задания в reprep.'
                c.execute('INSERT INTO reminder_deliveries VALUES(?,?,?,?)',(key,user['id'],kind,due))
                c.execute('INSERT INTO max_outbox(id,recipient,body,created) VALUES(?,?,?,?)',(key,recipient,dumps(body),stamp))
                pending+=1;queued+=1
    return queued


def install(app,cfg,user,db,fail):
    def allowed(u):
        if u['role'] not in ('tutor','learner'):fail(403,'ROLE','Напоминания доступны ученику и преподавателю')

    @app.get('/api/notifications')
    def notification_settings(u=Depends(user),c=Depends(db)):
        allowed(u);prefs=preferences(c,u['id'])
        connected=bool(u['external_id'] and one(c,'SELECT external_id FROM bot_contacts WHERE external_id=?',(u['external_id'],)))
        counts=rows(c,'SELECT o.status,count(*) n FROM max_outbox o JOIN reminder_deliveries r ON r.id=o.id WHERE r.user_id=? GROUP BY o.status',(u['id'],))
        return {'lessons':bool(prefs['lessons']),'assignments':bool(prefs['assignments']),'bot_started':connected,
            'delivery_enabled':cfg.max_bot_enabled and cfg.max_outbound_enabled,'deliveries':{r['status']:r['n'] for r in counts},
            'note':'Занятия — в течение ближайшего часа, сроки заданий — суток. Одинаковое время объединяется в одно напоминание. Реальная доставка внутри MAX ещё не проверена.'}

    @app.put('/api/notifications')
    def save_notifications(body:NotificationInput,u=Depends(user),c=Depends(db)):
        allowed(u)
        if body.assignments and u['role']!='learner':fail(422,'ROLE','Сроки заданий относятся к кабинету ученика')
        if (body.lessons or body.assignments) and (not u['external_id'] or not one(c,'SELECT external_id FROM bot_contacts WHERE external_id=?',(u['external_id'],))):fail(422,'MAX_CONTACT','Сначала войдите через MAX и откройте диалог с ботом')
        c.execute('INSERT INTO notification_settings VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET lessons=excluded.lessons,assignments=excluded.assignments',(u['id'],int(body.lessons),int(body.assignments)))
        for item in rows(c,"SELECT r.id FROM reminder_deliveries r JOIN max_outbox o ON o.id=r.id WHERE r.user_id=? AND o.status='queued'",(u['id'],)):
            if not valid_reminder(c,item['id'],time.time()):c.execute("UPDATE max_outbox SET status='cancelled' WHERE id=?",(item['id'],))
        return {'ok':True}
