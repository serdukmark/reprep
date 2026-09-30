"""Export the public OpenAPI schema and synthetic demo data without credentials."""
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
            operations.append((method.upper(),path))
    return schema,operations


def demo_data():
    """Synthetic accounts and learning records the demo stand starts from (users.demo=1)."""
    import sqlite3,tempfile
    with tempfile.TemporaryDirectory() as d:
        from fastapi.testclient import TestClient
        with TestClient(create_app(Settings(database=d+'/seed.sqlite',environment='test',demo=True),run_worker=False)):pass
        c=sqlite3.connect(d+'/seed.sqlite');c.row_factory=sqlite3.Row
        tables={'users':'SELECT id,role,alias,demo FROM users WHERE demo=1 ORDER BY id',
            'relationships':'SELECT * FROM relationships ORDER BY id','assignments':'SELECT id,tutor_id,relationship_id,status,data FROM assignments ORDER BY id',
            'lessons':'SELECT * FROM lessons ORDER BY id'}
        out={name:[dict(r) for r in c.execute(sql)] for name,sql in tables.items()}
    for row in out['assignments']+out['lessons']:
        row['data']=json.loads(row['data'])
    return {'note':'Все данные синтетические: демо-аккаунты помечены demo=1 и «• демо», в интерфейсе — «ДЕМО · СИНТЕТИЧЕСКИЕ ДАННЫЕ».',**out}


if __name__=='__main__':
    root=Path(__file__).resolve().parents[1]
    schema,operations=artifacts()
    (root/'openapi.json').write_text(json.dumps(schema,ensure_ascii=False,indent=2)+'\n')
    (root/'test-data').mkdir(exist_ok=True)
    (root/'test-data/demo-data.json').write_text(json.dumps(demo_data(),ensure_ascii=False,indent=2)+'\n')
    # DATA-API.yaml is maintained by hand in the organizers' DATA-API 1.0 format and checked by their validator.
    print(f'Exported {len(operations)} operations and synthetic demo data; no credentials included.')
