"""Single synthetic API rehearsal; no MAX, GUI input, deployment or real-person data."""
import argparse,json,sys,tempfile,time
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from fastapi.testclient import TestClient
from apps.server.config import Settings
from apps.server.main import create_app
from apps.server.ai import OpenRouterAdapter,LocalRules
from apps.server.models import GeneratedWork

class OfflineProvider(OpenRouterAdapter):
    def __init__(self):super().__init__("synthetic-offline-credential","explicit_offline_fixture")
    def analyze(self,context):return LocalRules().analyze(context)
    def generate_assignment(self,context):
        return GeneratedWork(title='Синтетическая генерация — НЕ живой AI',instructions='Решите пример.',tasks=[{'id':'sum','type':'numeric','prompt':'Сколько будет 2 + 3?','answer':'5','rubric':'Сложить два и три','skill':'Сложение','hint':'','options':[]}])


def run(live=False):
    started=time.perf_counter();steps=[]
    settings=Settings.load() if live else Settings()
    if live and (not settings.openrouter_key or not settings.openrouter_model):raise RuntimeError('Live model configuration missing')
    engine=OpenRouterAdapter(settings.openrouter_key,settings.openrouter_model) if live else OfflineProvider()
    with tempfile.TemporaryDirectory(prefix='reprep-rehearsal-') as temp:
        cfg=Settings(database=temp+'/demo.sqlite3',environment='test',demo=True,ai_daily_limit=3)
        app=create_app(cfg,provider=engine,run_worker=True)
        with TestClient(app) as c:
            h={r:{'Authorization':'Bearer '+c.post('/api/auth/demo/'+r).json()['token']} for r in ('tutor','learner','learner-2','outsider','guardian')}
            def call(method,path,role='tutor',body=None,expected=(200,201)):
                before=time.perf_counter();r=c.request(method,'/api/'+path,headers=h[role],**({'json':body} if body is not None else {}))
                if r.status_code not in expected:raise AssertionError(f'{method} {path}: HTTP {r.status_code}')
                steps.append({'step':method+' '+path,'role':role,'seconds':round(time.perf_counter()-before,3),'status':r.status_code})
                return r.json()
            call('GET','ready');call('GET','relationships')
            group=call('POST','groups',body={'title':'Репетиция: два ученика','relationship_ids':['demo-link','demo-link-2']})
            schedule={'revision':1,'client_id':'rehearsal-lesson','title':'Разбор сложения','starts_at':'2026-09-23T12:00:00Z','duration':45}
            call('POST','groups/'+group['id']+'/lessons',body=schedule)
            call('PUT','relationships/demo-link/plan',body={'revision':0,'goal':'Научиться проверять сумму','level':'Начальный','steps':[]})
            mid=call('POST','materials',body={'relationship_id':'demo-link','title':'Правило сложения','file_name':'addition.txt','content':'Сумма двух и трёх равна пяти. Сложение можно проверить пересчётом предметов.','ai_allowed':True})['id']
            path='materials/'+mid+'/generations';generation={'client_id':'rehearsal-generation','count':1}
            first=call('POST',path,body=generation);assert call('POST',path,body=generation)==first
            before=time.perf_counter()
            while c.get('/api/'+path,headers=h['tutor']).json()[0]['status'] in ('queued','processing'):
                assert time.perf_counter()-before<65,'Generation worker did not complete'
                time.sleep(.1)
            steps.append({'step':'generation worker','seconds':round(time.perf_counter()-before,3),'live_ai':live})
            job=call('GET',path)[0];assert job['status']=='completed','Generation unavailable; no successful rehearsal claimed'
            aid=job['assignment_id'];draft=call('GET','assignments/'+aid)
            call('GET','assignments/'+aid,'learner',expected=(404,))
            # Human-readable generated text is evidence for review, never a universal quality claim.
            generated={'title':draft['title'],'tasks':draft['tasks']}
            call('POST','assignments/'+aid+'/publish')
            assignments=call('POST','groups/'+group['id']+'/assign',body={'revision':1,'client_id':'rehearsal-group','assignment_id':aid})
            assert assignments['count']==2
            call('GET','assignments/'+aid,'learner-2',expected=(404,))
            answers={t['id']:t['answer'] for t in draft['tasks']}
            # API teacher knows the key; synthetic learner uses it only to exercise transport.
            call('PUT','assignments/'+aid+'/draft','learner',{'revision':0,'answers':answers})
            stale=call('PUT','assignments/'+aid+'/draft','learner',{'revision':0,'answers':answers},expected=(409,))
            saved=call('GET','assignments/'+aid,'learner');assert saved['draft']['answers']==answers
            request={'revision':1,'answers':answers}
            sid=call('POST','assignments/'+aid+'/submit','learner',request)['id']
            assert call('POST','assignments/'+aid+'/submit','learner',request)['id']==sid
            before=time.perf_counter()
            while c.get('/api/assignments/'+aid,headers=h['tutor']).json()['submission']['status'] in ('queued','processing'):
                assert time.perf_counter()-before<70,'Assessment worker did not complete'
                time.sleep(.1)
            steps.append({'step':'assessment worker','seconds':round(time.perf_counter()-before,3),'live_ai':live})
            work=call('GET','assignments/'+aid);analysis=work['submission']['analysis'];assert analysis['assessment_status'] in ('assessed','partially_assessed','cannot_assess'),analysis['assessment_status']
            assert call('GET','assignments/'+aid,'learner')['submission']['analysis'] is None
            review={'action':'confirmed','tasks':[{'task_id':t['task_id'],'correctness':t['correctness'],'feedback':t['feedback_for_learner']} for t in analysis['tasks']],'note':'Синтетическая репетиция, не независимая педагогическая проверка.'}
            decision=call('POST','submissions/'+sid+'/review',body=review);assert call('POST','submissions/'+sid+'/review',body=review)==decision
            call('GET','assignments/'+aid,'learner');assert call('GET','relationships/demo-link/progress','learner')
            skills=list(dict.fromkeys(t['skill'] for t in draft['tasks']))
            call('PUT','relationships/demo-link/skill-graph',body={'revision':0,'skills':skills,'edges':[]})
            call('GET','relationships/demo-link/skill-graph','learner')
            inv=call('POST','relationships/demo-link/guardians');call('POST','guardian/accept','guardian',{'token':inv['token']})
            assert call('GET','guardian/links/demo-link','guardian')['progress']
            call('GET','assignments/'+aid,'guardian',expected=(404,))
            call('GET','account/export','guardian');call('POST','guardian/invitations/'+inv['id']+'/revoke')
            call('GET','guardian/links/demo-link','guardian',expected=(404,))
            wid=call('POST','workspaces',body={'title':'Методическая библиотека'})['id']
            invite=call('POST','workspaces/'+wid+'/invite');call('POST','workspaces/accept','outsider',{'token':invite['token']})
            call('POST','workspaces/'+wid+'/templates',body={'assignment_id':aid});assert call('GET','workspaces/'+wid+'/templates','outsider')
            call('GET','assignments/'+aid,'outsider',expected=(404,))
            call('POST','workspaces/'+wid+'/members/demo-outsider/remove')
            call('GET','workspaces/'+wid+'/templates','outsider',expected=(404,))
            offer={'revision':0,'visible':True,'headline':'Синтетический преподаватель','description':'Анкета репетиции без реальных контактов','subjects':['Математика'],'price_rub':500,'duration':60}
            call('PUT','catalog/profile','outsider',offer);assert call('GET','catalog','learner')['items']
            req=call('POST','catalog/demo-outsider/requests','learner',{'offer_revision':1,'subject':'Математика','message':'Синтетический запрос','client_id':'rehearsal-catalog'})
            call('POST','catalog/requests/'+req['id']+'/review','outsider',{'decision':'accepted','reply':'Синтетический ответ'})
            assert call('GET','account/export','learner')['submissions']
            assert call('GET','notifications','learner')['delivery_enabled'] is False
            call('GET','calendar','learner');call('GET','reminders','learner')
            report={'passed':True,'duration_seconds':round(time.perf_counter()-started,3),'live_ai':live,'model':settings.openrouter_model if live else 'explicit_offline_fixture','gui_input':False,'background_worker':True,'manual_rehearsal':False,'MAX':False,'steps':steps,'generated':generated,'analysis':analysis,'generation_usage':getattr(engine,'last_generation_usage',{}),'assessment_usage':getattr(engine,'last_usage',{}),'limitations':['API sequence, not human click timing','synthetic learner uses reference answer','UI and MAX require separate verification']}
            out=Path('docs/evidence/rehearsal-live.json' if live else 'artifacts/rehearsal-offline.json');out.parent.mkdir(exist_ok=True,parents=True);out.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
            print(json.dumps({k:report[k] for k in ('passed','duration_seconds','live_ai','gui_input','MAX')},ensure_ascii=False))
            print('Slow stages:',[(x['step'],x['seconds']) for x in steps if x['seconds']>2])

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--live',action='store_true',help='Two paid synthetic AI calls; <=$1/M provider caps');args=parser.parse_args()
    run(args.live)
