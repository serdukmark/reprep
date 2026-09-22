"""Explicit private synthetic HTTPS rehearsal; no MAX login or browser automation.
Creates temporary test sessions through authorized VM administration; revokes them
in finally. Does not change deployment/data policy or publish catalog profiles.
"""
import argparse
import json
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import time
from unittest.mock import patch
import httpx

ORIGIN='https://reprep.2-26-49-28.nip.io'
SSH=['ssh','-i',str(Path.home()/'.ssh/jarvis_vm_ed25519'),'-o','IdentityAgent=none','-o','IdentitiesOnly=yes','-o','BatchMode=yes','-o','ConnectTimeout=10','root@2.26.49.28','docker exec -i reprep-app-1 python -']


def remote(source):
    result=subprocess.run(SSH,input=source,text=True,capture_output=True,timeout=30)
    if result.returncode:raise RuntimeError('VM administration failed; output suppressed')
    return json.loads(result.stdout)


def network_recovery(client, headers, link):
    events=[]
    def request(method,path,**kw):
        r=client.request(method,ORIGIN+'/api/'+path,headers=headers(0),**kw)
        assert r.status_code in (200,201)
        return r.json()
    body={'relationship_id':link,'title':'Синтетическая потеря ответа HTTPS',
          'tasks':[{'id':'t','type':'numeric','prompt':'2+3?','answer':'5','skill':'Сложение'}]}
    aid=request('POST','assignments',json=body)['id']
    request('POST','assignments/'+aid+'/publish')
    learner_headers=headers(1)
    url=ORIGIN+'/api/assignments/'+aid
    class LostAcknowledgement(httpx.BaseTransport):
        def __init__(self): self.transport=httpx.HTTPTransport()
        def handle_request(self,request):
            response=self.transport.handle_request(request)
            response.read(); status=response.status_code; response.close()
            assert status==200
            raise httpx.ReadError('Synthetic loss after real server commit',request=request)
        def close(self): self.transport.close()
    with httpx.Client(transport=LostAcknowledgement(),timeout=12) as disconnected:
        try:
            disconnected.put(url+'/draft',headers=learner_headers,json={'revision':0,'answers':{'t':'5'}})
            raise AssertionError('Expected lost acknowledgement')
        except httpx.ReadError: events.append('real_HTTPS_write_committed_ack_dropped_by_client_transport')
    recovered=client.get(url,headers=headers(2));assert recovered.status_code==200
    assert recovered.json()['draft']['answers']=={'t':'5'}
    conflict=client.put(url+'/draft',headers=headers(2),json={'revision':0,'answers':{'t':'stale'}})
    assert conflict.status_code==409; events.append('second_session_stale_write_409')
    def offline(request): raise httpx.ConnectError('Synthetic offline client',request=request)
    with httpx.Client(transport=httpx.MockTransport(offline)) as offline_client:
        try: offline_client.get(url,headers=learner_headers)
        except httpx.ConnectError: events.append('client_offline_simulation_no_server_change')
    # Fresh transport, same independently issued learner session, persisted draft.
    with httpx.Client(timeout=12,trust_env=False) as refreshed:
        restored=refreshed.get(url,headers=headers(2))
        assert restored.status_code==200 and restored.json()['draft']['answers']=={'t':'5'}
        assert restored.json()['submission'] is None
    events.append('fresh_HTTP_client_restores_draft_no_submission_created')
    return events


def run(connect_ip=None, network_only=False):
    run_id='https-test-'+secrets.token_hex(6)
    roles={'tutor':'tutor','learner':'learner','learner2':'learner','outsider':'tutor','guardian':'guardian'}
    accounts=remote('''import json,secrets,time
from apps.server.config import Settings
from apps.server.db import connect
from apps.server.auth import token_hash
prefix='''+repr(run_id)+'''
roles='''+repr(roles)+'''
result={}
with connect(Settings.load().database) as db:
 for name,role in roles.items():
  uid=prefix+'-'+name
  db.execute('INSERT INTO users(id,role,alias,demo) VALUES(?,?,?,1)',(uid,role,'Синтетическая HTTPS-проверка: '+name))
  tokens=[secrets.token_urlsafe(32) for _ in range(2)]
  for token in tokens: db.execute('INSERT INTO sessions VALUES(?,?,?)',(token_hash(token),uid,time.time()+1800))
  result[name]={'id':uid,'tokens':tokens}
 for name in ('learner','learner2'):
  db.execute('INSERT INTO relationships VALUES(?,?,?,?)',(prefix+'-'+name+'-link',result['tutor']['id'],result[name]['id'],'Синтетическая математика'))
print(json.dumps(result))
''')
    started=time.monotonic();steps=[];evidence={'passed':False,'run_id':run_id,'origin':ORIGIN,'gui':False,'MAX_login':False,'connect_ip_override':connect_ip,'steps':steps}
    def headers(role,tab=0):return {'Authorization':'Bearer '+accounts[role]['tokens'][tab]}
    try:
        with httpx.Client(timeout=12,trust_env=False,follow_redirects=False) as c:
            if network_only:
                evidence['network_recovery']=network_recovery(c,lambda n:headers('tutor') if n==0 else headers('learner',n-1),run_id+'-learner-link')
                evidence['passed']=True
                return evidence
            def call(method,path,role='tutor',body=None,status=(200,201),tab=0):
                begin=time.monotonic()
                r=c.request(method,ORIGIN+'/api/'+path,headers=headers(role,tab),**({'json':body} if body is not None else {}))
                steps.append({'method':method,'path':path,'role':role,'status':r.status_code,'seconds':round(time.monotonic()-begin,3)})
                if r.status_code not in status:raise AssertionError('Unexpected HTTP status in '+method+' '+path+': '+str(r.status_code))
                return r.json()
            for role in roles:assert call('GET','me',role)['demo']==1
            link=run_id+'-learner-link'
            body={'relationship_id':link,'title':'Синтетическая HTTPS-репетиция','instructions':'Решите уравнение.',
                  'tasks':[{'id':'linear','type':'numeric','prompt':'3x + 7 = 22. Найдите x.','answer':'5','rubric':'Вычесть 7, разделить на 3.','skill':'Линейные уравнения'}]}
            aid=call('POST','assignments',body=body)['id']
            call('GET','assignments/'+aid,'learner',status=(404,))
            call('POST','assignments/'+aid+'/publish')
            answers={'linear':'x=4, потому что 22-7=12, 12/3=4'}
            call('PUT','assignments/'+aid+'/draft','learner',{'revision':0,'answers':answers})
            call('PUT','assignments/'+aid+'/draft','learner',{'revision':0,'answers':{'linear':'stale'}},status=(409,),tab=1)
            # A new HTTP client/session simulates reloading persistent state, not a browser refresh.
            assert call('GET','assignments/'+aid,'learner',tab=1)['draft']['answers']==answers
            request={'revision':1,'answers':answers}
            sid=call('POST','assignments/'+aid+'/submit','learner',request)['id']
            # Deliberately ignore the first successful response, like a lost acknowledgement.
            assert call('POST','assignments/'+aid+'/submit','learner',request,tab=1)['id']==sid
            wait_start=time.monotonic()
            while True:
                work=call('GET','assignments/'+aid)
                if work['submission']['status'] not in ('queued','processing'):break
                assert time.monotonic()-wait_start<80,'AI worker timeout'
                time.sleep(1)
            analysis=work['submission']['analysis']
            evidence['ai_wait_seconds']=round(time.monotonic()-wait_start,3)
            evidence['analysis']=analysis
            assert analysis and analysis['assessment_status'] in ('assessed','partially_assessed'), 'Live AI did not assess'
            assert call('GET','assignments/'+aid,'learner')['submission']['analysis'] is None
            call('GET','assignments/'+aid,'outsider',status=(404,))
            call('GET','submissions/'+sid,'learner2',status=(404,))
            review={'action':'corrected','tasks':[{'task_id':'linear','correctness':'incorrect','feedback':'Вычитание: 22 − 7 = 15, поэтому x = 5. Проверка: 3 × 5 + 7 = 22.'}], 'note':'Синтетическая API-проверка роли преподавателя; не ручное педагогическое ревью.'}
            result=call('POST','submissions/'+sid+'/review',body=review)
            assert call('POST','submissions/'+sid+'/review',body=review,tab=1)==result
            learner=call('GET','assignments/'+aid,'learner');assert learner['submission']['status']=='reviewed'
            assert call('GET','relationships/'+link+'/progress','learner')
            inv=call('POST','relationships/'+link+'/guardians')
            call('POST','guardian/accept','guardian',{'token':inv['token']})
            assert call('GET','guardian/links/'+link,'guardian')['progress']
            call('GET','assignments/'+aid,'guardian',status=(404,))
            call('POST','guardian/invitations/'+inv['id']+'/revoke')
            for tab in (0,1):
                call('GET','guardian/links/'+link,'guardian',status=(404,),tab=tab)
                assert call('GET','account/export','guardian',tab=tab)['assignments']==[]
            wid=call('POST','workspaces',body={'title':'Приватная синтетическая библиотека HTTPS'})['id']
            inv=call('POST','workspaces/'+wid+'/invite')
            call('POST','workspaces/accept','outsider',{'token':inv['token']})
            tid=call('POST','workspaces/'+wid+'/templates',body={'assignment_id':aid})['id']
            assert call('GET','workspaces/'+wid+'/templates','outsider')
            call('GET','assignments/'+aid,'outsider',status=(404,))
            call('POST','workspaces/'+wid+'/members/'+accounts['outsider']['id']+'/remove')
            for tab in (0,1):
                for path in ('templates','members','invitations'):
                    call('GET','workspaces/'+wid+'/'+path,'outsider',status=(404,),tab=tab)
                call('POST','workspace-templates/'+tid+'/copy','outsider',{'relationship_id':link,'client_id':run_id+'-copy'},status=(404,),tab=tab)
            evidence['passed']=True
    except Exception as exc:
        evidence['failure_type']=type(exc).__name__
        # No exception bodies: they may contain request headers or confidential data.
        raise
    finally:
        evidence['duration_seconds']=round(time.monotonic()-started,3)
        try:
            result=remote('''import json
from apps.server.config import Settings
from apps.server.db import connect
ids='''+repr([v['id'] for v in accounts.values()])+'''
with connect(Settings.load().database) as db:
 for uid in ids: db.execute('DELETE FROM sessions WHERE user_id=?',(uid,))
print(json.dumps({'revoked':True}))
''')
            evidence['test_sessions_revoked']=result['revoked']
        except Exception:
            evidence['test_sessions_revoked']=False
        evidence['limitations']=['API sequence, not visual rehearsal','synthetic accounts provisioned by operator, not MAX authentication','no provider faults injected into production','private synthetic records retained; test sessions revoked or expire after 30 minutes']
        p=Path('docs/evidence/public-network-recovery.json' if network_only else 'docs/evidence/public-rehearsal.json');p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps({k:evidence.get(k) for k in ('passed','duration_seconds','ai_wait_seconds','test_sessions_revoked','failure_type')}))
    return evidence


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--network-only',action='store_true',help='Private draft recovery, no AI calls')
    parser.add_argument('--connect-ip',choices=['2.26.49.28'])
    args=parser.parse_args()
    if not args.apply:raise SystemExit('No action; --apply creates private synthetic records and invokes live AI.')
    original=socket.getaddrinfo
    def resolve(host,*rest,**kw):
        if args.connect_ip and host in ('reprep.2-26-49-28.nip.io',b'reprep.2-26-49-28.nip.io'):host=args.connect_ip
        return original(host,*rest,**kw)
    try:
        with patch('socket.getaddrinfo',side_effect=resolve):run(args.connect_ip,args.network_only)
    except Exception:
        raise SystemExit('Public rehearsal failed; sanitized evidence saved. No success claimed.')
