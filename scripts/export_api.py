"""Export the public schema and evaluation manifest without exporting credentials."""
import json
from pathlib import Path
from apps.server.main import create_app
from apps.server.config import Settings


PUBLIC_BASE_URL='https://reprep.ru'
LOCAL_BASE_URL='http://127.0.0.1:8000'


def artifacts():
    app=create_app(Settings(environment='test'),run_worker=False)
    schema=app.openapi()
    schema['servers']=[{'url':PUBLIC_BASE_URL,'description':'Public judging stand; sign-in only through MAX init_data, demo logins disabled'},
        {'url':LOCAL_BASE_URL,'description':'Local Docker run (docker compose up --build); demo logins enabled'}]
    operations=[]
    for path,methods in schema['paths'].items():
        if not path.startswith('/api/'):continue
        for method,op in methods.items():
            if method not in ('get','post','put','delete','patch'):continue
            public=op.get('x-roles')==['public']
            webhook='webhook' in path
            role=op.get('x-roles',['public'])
            if not public:
                op.setdefault('security',[{'MaxWebhookSecret' if webhook else 'SessionBearer':[]}])
                for code,description in [('401','Invalid or expired authorization'),('403','Role or origin forbidden'),('404','Resource not visible to this account')]:
                    op['responses'].setdefault(code,{'description':description})
            if method!='get':op['responses'].setdefault('409',{'description':'Version, state or replay conflict when applicable'})
            operations.append({'method':method.upper(),'path':path,'role':role,'parameters':op.get('parameters',[]),
                'request_body':op.get('requestBody'), 'expected_responses':op['responses'],
                'response_contract':'See openapi.json for output envelopes, fields and role visibility; AI payloads remain extensible objects.'})
    manifest={'schema_version':'1.0','schema_version_note':'Project manifest version; organizer parser schema not supplied',
        'solution':'reprep','base_url':PUBLIC_BASE_URL,'local_base_url':LOCAL_BASE_URL,
        'status':'public HTTPS stand; public endpoints: GET /api/health, GET /api/ready, GET /api/openapi.json, GET /api/docs',
        'openapi':f'{PUBLIC_BASE_URL}/api/openapi.json','openapi_file':'openapi.json',
        'authentication':{'production':f'POST {PUBLIC_BASE_URL}/api/auth/max; genuine signed MAX init_data required (open the mini app from the bot)',
        'local_tutor':f'POST {LOCAL_BASE_URL}/api/auth/demo/tutor','local_learner':f'POST {LOCAL_BASE_URL}/api/auth/demo/learner',
        'header':'Authorization: Bearer <session token>',
        'credentials':'No keys in this file. Demo login requires DEMO_ENABLED and non-production environment, so it works only in the local Docker run.'},
        'test_data':{'script':'python scripts/seed_demo.py','source':'apps/server/service.py','synthetic':True,
        'note':'All demo tutors, learners, assignments and catalog profiles are fictional; they are seeded automatically in the local Docker run.'},
        'checks':operations,'executable_checks':['tests/test_workflow.py','tests/test_failure_paths.py','tests/test_plan_discussion.py','tests/test_max.py'],
        'release_gates':['Real MAX flow inside the messenger','Organizer DATA-API schema confirmation']}
    return schema,manifest


if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]
    schema,manifest=artifacts()
    for name,value in [('openapi.json',schema),('DATA-API.yaml',manifest)]:
        # JSON is a valid YAML 1.2 representation; keeps generation dependency-free.
        (root/name).write_text(json.dumps(value,ensure_ascii=False,indent=2)+'\n')
    print(f'Exported {len(manifest["checks"])} operations; no credentials included.')
