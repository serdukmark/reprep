"""Document output envelopes and actual role/session dependencies, without secrets."""
from copy import deepcopy


def enrich(schema,routes,base_url):
    string={'type':'string'};integer={'type':'integer'}
    def obj(properties,required=None):return {'type':'object','properties':properties,'required':list(properties) if required is None else required}
    def array(item):return {'type':'array','items':item}
    def ref(name):return {'$ref':'#/components/schemas/'+name}
    def nullable(item):return {'anyOf':[item,{'type':'null'}]}
    schemas=schema.setdefault('components',{}).setdefault('schemas',{})
    schemas['ApiError']=obj({'error':obj({'code':string,'message':string,'reference_id':string})})
    schemas['Account']=obj({'id':string,'role':{'type':'string','enum':['tutor','learner']},'alias':string,'demo':{'type':'integer','enum':[0,1]}})
    schemas['Session']=obj({'token':string,'user':ref('Account')})
    def output_copy(source, name, added=None, removed=()):
        result=deepcopy(schemas[source])
        result.pop('title',None)
        for key in removed:result['properties'].pop(key,None)
        result['properties'].update(added or {})
        result['required']=[key for key in result.get('required',[]) if key not in removed]
        result['required'].extend((added or {}).keys())
        schemas[name]=result
    output_copy('ReviewInput','StoredReview',{'created':string})
    output_copy('Task','VisibleTask')
    schemas['VisibleTask']['required']=[key for key in schemas['VisibleTask'].get('required',[]) if key not in ('answer','rubric','hint')]
    output_copy('LessonInput','StoredLesson',{'id':string})
    output_copy('MaterialInput','StoredMaterial',{'id':string},('content',))
    schemas['StoredSubmission']=obj({'id':string,'status':string,'attempt':integer,'answers':{'type':'object','additionalProperties':string},
        'submitted':string,'analysis':nullable({'type':'object','description':'Preliminary assessment; returned only to owning tutor'}),
        'review':nullable(ref('StoredReview')),'hints':{'type':'object','additionalProperties':string}},['id','status','attempt','answers','submitted','analysis','review'])
    schemas['StoredAssignment']=obj({'id':string,'title':string,'instructions':string,'relationship_id':string,'lesson_id':string,
        'status':{'type':'string','enum':['draft','published']},'revision':integer,'due_at':nullable(string),'feedback_policy':string,
        'tasks':array(ref('VisibleTask')),'created':string,'draft':obj({'revision':integer,'answers':{'type':'object','additionalProperties':string}}),
        'submission':nullable(ref('StoredSubmission'))},['id','title','relationship_id','status','revision','tasks'])
    schemas['AssignmentSummary']=obj({'id':string,'title':string,'due_at':nullable(string),'status':string,'relationship_id':string,
        'learner_alias':string,'tasks_count':integer,'submission':nullable(obj({'id':string,'status':string,'attempt':integer},['id','status']))})
    schemas['StudyRelation']=obj({'id':string,'tutor_id':string,'learner_id':string,'tutor_alias':string,'learner_alias':string,'subject':string})
    schemas['ProgressEntry']=obj({'skill':string,'correct':integer,'total':integer,'latest':string,'evidence':array(obj({'id':string,'submission_id':string,'review_id':string,'task_id':string,'correctness':string,'assignment_title':string},['id','submission_id','review_id','task_id','correctness','assignment_title']))})
    schemas['PlanView']=obj({'revision':integer,'goal':string,'level':string,'steps':array(ref('PlanStep'))})
    schemas['StoredGroup']=obj({'id':string,'title':string,'revision':integer,'relationship_ids':array(string)})
    schemas['StudyMessage']=obj({'id':string,'cursor':integer,'text':string,'created':string,'alias':string,'role':string})
    schemas['StudyQuestion']=obj({'id':string,'cursor':integer,'task_id':string,'question':string,'status':string,'created':string,
        'response':nullable(string),'needs_teacher':{'type':'boolean'},'draft':nullable({'type':'object','description':'Hidden from learner; contains text/status/confidence/engine/prompt_version for tutor'})})
    file_result=obj({'file_name':string,'content':string,'content_type':string,'note':string},['file_name','content'])
    id_result=obj({'id':string})
    ok_result=obj({'ok':{'type':'boolean'}})
    outputs={
        'me':ref('Account'),'profile':ref('Account'),'relationships':array(ref('StudyRelation')),
        'assignments':array(ref('AssignmentSummary')),'create_assignment':ref('StoredAssignment'),'edit_assignment':ref('StoredAssignment'),'get_assignment':ref('StoredAssignment'),
        'submission_detail':ref('StoredSubmission'),'get_progress':array(ref('ProgressEntry')),
        'groups':array(ref('StoredGroup')),'create_group':ref('StoredGroup'),'edit_group':ref('StoredGroup'),
        'assign_group':obj({'assignment_ids':array(string),'count':integer}),'schedule_group':obj({'lesson_ids':array(string),'count':integer}),
        'learning_plan':ref('PlanView'),'save_plan':ref('PlanView'),'messages':array(ref('StudyMessage')),'questions':array(ref('StudyQuestion')),
        'material_file':file_result,'export_calendar':file_result,
        'generations':array(obj({'id':string,'count':integer,'status':string,'assignment_id':nullable(string),'created':string})),
        'export':obj({'subject':string,'exported_at':string,'progress':array(ref('ProgressEntry'))}),
        'save_draft':obj({'revision':integer}),
        'preview_invite':obj({'tutor_alias':string,'subject':string,'expires':{'type':'number'}}),
        'invite':obj({'id':string,'token':string,'expires':{'type':'number'}}),
        'invitations':array(obj({'id':string,'subject':string,'expires':{'type':'number'},'state':string})),
    }
    outputs.update({
        'health':obj({'status':string}),
        'ready':obj({'ready':{'type':'boolean'},'checks':array(string),'external_services':string}),
        'config':obj({'demo_enabled':{'type':'boolean'},'max_enabled':{'type':'boolean'},'assessment':string,'version':string}),
        'max_webhook':obj({'ok':{'type':'boolean'},'status':string}),
        'attempts':obj({'items':array(obj({'id':string,'attempt':integer,'status':string,'submitted':string})),'next_offset':nullable(integer)}),
        'lessons':array(ref('StoredLesson')),
        'materials':array(ref('StoredMaterial')),
        'recommendations':array(obj({'skill':string,'reason':string,'action':string,'evidence_id':string,'source_assignment_id':string,'basis':string,'automatic_assignment':{'const':False}})),
        'analytics':obj({'assignments':integer,'published':integer,'submissions':integer,'review_actions':{'type':'object','additionalProperties':integer},'ai_failures':integer,'external_ai_attempts_today':integer,'daily_limit':integer,'limit_scope':string,'note':string}),
        'reminders':obj({'channel':string,'note':string,'items':array(obj({'id':string,'kind':string,'title':string,'at':string,'resource_id':string}))}),
    })
    for name in ('duplicate','submit','review','create_lesson','create_material','report','ask_question','send_message','generate_material'):outputs[name]=id_result
    for name in ('publish','accept','decline_invite','revoke','logout','retry','edit_lesson','review_question'):outputs[name]=ok_result
    tutors={'invite','invitations','revoke','create_assignment','edit_assignment','publish','duplicate','retry','review','recommendations','analytics','groups','create_group','edit_group','assign_group','schedule_group','save_plan','review_question','create_lesson','edit_lesson','create_material','generations','generate_material','reset'}
    learners={'preview_invite','accept','decline_invite','save_draft','submit','ask_question'}
    schema['components']['securitySchemes']={'SessionBearer':{'type':'http','scheme':'bearer'},'MaxWebhookSecret':{'type':'apiKey','in':'header','name':'X-Max-Bot-Api-Secret'}}
    schema['servers']=[{'url':base_url or 'http://127.0.0.1:8000','description':'Configured origin; localhost is not a public judging endpoint'}]
    for route in routes:
        if not getattr(route,'path','').startswith('/api/') or not hasattr(route,'dependant'):continue
        name=route.endpoint.__name__
        authenticated=any(getattr(d.call,'__name__','')=='user' for d in route.dependant.dependencies)
        webhook='webhook' in route.path
        for method in route.methods:
            op=schema.get('paths',{}).get(route.path,{}).get(method.lower())
            if not op:continue
            roles=['tutor'] if name in tutors else ['learner'] if name in learners else ['tutor','learner'] if authenticated else ['MAX webhook'] if webhook else ['public']
            op['x-roles']=roles
            if authenticated or webhook:op['security']=[{'MaxWebhookSecret' if webhook else 'SessionBearer':[]}]
            if authenticated:
                for status in ('401','403','404'):op['responses'].setdefault(status,{'description':'Authorization, role or resource visibility error'})
            for status,response in op['responses'].items():
                if int(status)>=400:response['content']={'application/json':{'schema':ref('ApiError')}}
            if name in outputs:
                for status,response in op['responses'].items():
                    if status in ('200','201'):response['content']={'application/json':{'schema':outputs[name]}}
            if name=='reset' or route.path.startswith('/api/auth/') and name!='logout':
                op['responses'].setdefault('200',{'description':'Session created'})['content']={'application/json':{'schema':ref('Session')}}
            if name=='ready':op['responses']['503']={'description':'Database unavailable','content':{'application/json':{'schema':obj({'ready':{'type':'boolean'},'checks':array(string),'external_services':string})}}}
    return schema
