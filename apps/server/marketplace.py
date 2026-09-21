"""Opt-in tutor catalog and consensual study requests, with no money movement."""
import json
from typing import Literal
from fastapi import Depends
from pydantic import Field,field_validator
from .models import Model
from .db import one,rows,dumps
from .service import uid,now,audit


class TutorOffer(Model):
    revision:int=Field(ge=0)
    visible:bool=False
    headline:str=Field(min_length=3,max_length=120)
    description:str=Field(min_length=10,max_length=1200)
    subjects:list[str]=Field(min_length=1,max_length=10)
    price_rub:int=Field(ge=0,le=100000)
    duration:int=Field(ge=15,le=240)

    @field_validator('subjects')
    @classmethod
    def subjects_valid(cls,value):
        value=[s.strip() for s in value]
        if any(len(s)<2 or len(s)>100 for s in value) or len({s.casefold() for s in value})!=len(value):raise ValueError('Укажите разные предметы длиной 2–100 символов')
        return value


class TutorRequest(Model):
    offer_revision:int=Field(ge=1)
    subject:str=Field(min_length=2,max_length=100)
    message:str=Field(min_length=3,max_length=1000)
    client_id:str=Field(min_length=8,max_length=100)


class TutorRequestReview(Model):
    decision:Literal['accepted','declined']
    reply:str=Field(default='',max_length=1000)


def install(app,user,db,tutor,learner,fail):
    @app.get('/api/catalog/profile')
    def catalog_profile(u=Depends(user),c=Depends(db)):
        tutor(u);item=one(c,'SELECT * FROM tutor_offers WHERE tutor_id=?',(u['id'],))
        return {'revision':item['revision'],'offer':json.loads(item['data'])} if item else {'revision':0,'offer':None}

    @app.put('/api/catalog/profile')
    def save_catalog_profile(body:TutorOffer,u=Depends(user),c=Depends(db)):
        tutor(u);old=one(c,'SELECT revision FROM tutor_offers WHERE tutor_id=?',(u['id'],))
        revision=old['revision'] if old else 0
        if body.revision!=revision:fail(409,'VERSION_CONFLICT','Анкета изменена в другом окне')
        data=body.model_dump(exclude={'revision'})
        c.execute('INSERT INTO tutor_offers VALUES(?,?,?) ON CONFLICT(tutor_id) DO UPDATE SET revision=excluded.revision,data=excluded.data',(u['id'],revision+1,dumps(data)))
        audit(c,u['id'],'catalog_profile_updated',u['id'])
        return {'revision':revision+1}

    @app.get('/api/catalog')
    def catalog(q:str='',max_price:int=100000,u=Depends(user),c=Depends(db)):
        if len(q)>100 or max_price<0 or max_price>100000:fail(422,'FILTER','Некорректный фильтр')
        result=[]
        for row in rows(c,'SELECT o.tutor_id,o.revision,o.data,u.alias FROM tutor_offers o JOIN users u ON u.id=o.tutor_id WHERE u.demo=? ORDER BY o.tutor_id LIMIT 500',(u['demo'],)):
            offer=json.loads(row['data'])
            searchable=' '.join([row['alias'],offer['headline'],*offer['subjects']]).casefold()
            if offer['visible'] and offer['price_rub']<=max_price and q.strip().casefold() in searchable:
                result.append({'id':row['tutor_id'],'alias':row['alias'],'revision':row['revision'],**offer})
        return {'items':result[:100],'note':'Анкеты заполнены преподавателями. Подбор по предмету и заявленной цене, без рейтинга качества. Оплата не проводится.'}

    @app.post('/api/catalog/{id_}/requests',status_code=201)
    def request_tutor(id_:str,body:TutorRequest,u=Depends(user),c=Depends(db)):
        learner(u)
        old=one(c,'SELECT * FROM tutor_requests WHERE learner_id=? AND client_id=?',(u['id'],body.client_id))
        if old:
            if old['tutor_id']!=id_ or old['subject']!=body.subject or old['message']!=body.message or old['offer_revision']!=body.offer_revision:fail(409,'REPLAY','Код заявки уже использован')
            return {'id':old['id']}
        row=one(c,'SELECT o.data,o.revision,t.demo FROM tutor_offers o JOIN users t ON t.id=o.tutor_id WHERE o.tutor_id=?',(id_,))
        if not row or row['demo']!=u['demo']:fail(404,'OFFER','Анкета недоступна')
        offer=json.loads(row['data'])
        if not offer['visible'] or body.subject not in offer['subjects']:fail(404,'OFFER','Предложение изменилось; обновите каталог')
        if row['revision']!=body.offer_revision:fail(409,'OFFER_CHANGED','Условия анкеты изменились. Обновите каталог перед заявкой')
        count=one(c,'SELECT count(*) n FROM tutor_requests WHERE learner_id=? AND substr(created,1,10)=?',(u['id'],now()[:10]))['n']
        if count>=10:fail(429,'LIMIT','Не более 10 заявок в день')
        rid=uid();c.execute('INSERT INTO tutor_requests(id,learner_id,tutor_id,client_id,subject,message,offer_revision,price_rub,duration,created) VALUES(?,?,?,?,?,?,?,?,?,?)',(rid,u['id'],id_,body.client_id,body.subject,body.message,body.offer_revision,offer['price_rub'],offer['duration'],now()))
        audit(c,u['id'],'tutor_requested',rid)
        return {'id':rid}

    @app.get('/api/catalog/requests')
    def tutor_requests(u=Depends(user),c=Depends(db)):
        if u['role']=='guardian':fail(403,'ROLE','Заявки доступны ученику и преподавателю')
        return rows(c,'SELECT r.id,r.subject,r.message,r.price_rub,r.duration,r.status,r.reply,r.relationship_id,r.created,l.alias learner_alias,t.alias tutor_alias FROM tutor_requests r JOIN users l ON l.id=r.learner_id JOIN users t ON t.id=r.tutor_id WHERE r.learner_id=? OR r.tutor_id=? ORDER BY r.created DESC LIMIT 100',(u['id'],u['id']))

    @app.post('/api/catalog/requests/{id_}/review')
    def review_tutor_request(id_:str,body:TutorRequestReview,u=Depends(user),c=Depends(db)):
        tutor(u);item=one(c,'SELECT * FROM tutor_requests WHERE id=? AND tutor_id=?',(id_,u['id']))
        if not item:fail(404,'REQUEST','Заявка недоступна')
        if item['status']!='pending':
            if item['status']!=body.decision or item['reply']!=body.reply:fail(409,'STATE','По заявке уже принято решение')
            return {'relationship_id':item['relationship_id']}
        relationship_id=None
        if body.decision=='accepted':
            old=one(c,'SELECT id FROM relationships WHERE tutor_id=? AND learner_id=? AND subject=?',(u['id'],item['learner_id'],item['subject']))
            relationship_id=old['id'] if old else uid()
            if not old:c.execute('INSERT INTO relationships VALUES(?,?,?,?)',(relationship_id,u['id'],item['learner_id'],item['subject']))
        c.execute('UPDATE tutor_requests SET status=?,reply=?,relationship_id=? WHERE id=?',(body.decision,body.reply,relationship_id,id_))
        audit(c,u['id'],'tutor_request_'+body.decision,id_)
        return {'relationship_id':relationship_id}
