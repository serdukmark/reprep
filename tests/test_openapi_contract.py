from tests.test_workflow import env


def test_openapi_roles_error_envelope_and_references(env):
    c,app,cfg,h=env
    schema=c.get('/api/openapi.json').json()
    assert schema['openapi'].startswith('3.')
    assert schema['paths']['/api/logout']['post']['security']==[{'SessionBearer':[]}]
    assert schema['paths']['/api/assignments/{id_}/submit']['post']['x-roles']==['learner']
    assert schema['paths']['/api/groups']['post']['x-roles']==['tutor']
    params=schema['paths']['/api/questions/{id_}/review']['post']['parameters']
    assert [p['name'] for p in params]==['id_']
    def refs(node):
        if isinstance(node,dict):
            if '$ref' in node:
                target=schema
                for part in node['$ref'].split('/')[1:]:target=target[part]
                assert target
            for value in node.values():refs(value)
        elif isinstance(node,list):
            for value in node:refs(value)
    refs(schema)
    response=c.post('/api/questions/missing/review',headers=h['tutor'],json={'text':''})
    assert response.status_code==422
    assert set(response.json()['error'])=={'code','message','reference_id'}
    declared=schema['paths']['/api/questions/{id_}/review']['post']['responses']['422']['content']['application/json']['schema']
    assert declared=={'$ref':'#/components/schemas/ApiError'}


def test_every_api_success_has_output_schema_and_empty_plan_is_valid(env):
    c,app,cfg,h=env
    schema=app.openapi()
    for path,methods in schema['paths'].items():
        if not path.startswith('/api/'):continue
        for op in methods.values():
            for status,response in op['responses'].items():
                if status in ('200','201'):
                    assert response.get('content',{}).get('application/json',{}).get('schema'),path
    empty=c.get('/api/relationships/demo-link/plan',headers=h['learner']).json()
    assert empty['goal']=='' and empty['steps']==[]
    assert schema['components']['schemas']['PlanView']['properties']['goal']=={'type':'string'}


def test_output_fields_match_role_filtered_records(env):
    import asyncio
    from tests.test_workflow import submit,review
    c,app,cfg,h=env
    schemas=app.openapi()['components']['schemas']
    def fields(name,actual):
        declared=schemas[name]
        assert set(declared.get('required',[])) <= set(actual),name
        if declared.get('additionalProperties') is False:
            assert set(actual) <= set(declared['properties']),name
    material=c.post('/api/materials',headers=h['tutor'],json={
        'relationship_id':'demo-link','title':'Источник','content':'Образец текста',
        'file_name':'source.txt'}).json()['id']
    sid=submit(c,h['learner']).json()['id']
    asyncio.run(app.state.process_one());review(c,h['tutor'],sid)
    for role in ('tutor','learner'):
        assignment=c.get('/api/assignments/demo-assignment',headers=h[role]).json()
        for task in assignment['tasks']:fields('VisibleTask',task)
        fields('StoredReview',assignment['submission']['review'])
        for lesson in c.get('/api/lessons',headers=h[role]).json():fields('StoredLesson',lesson)
        materials=c.get('/api/materials',headers=h[role]).json()
        stored=next(item for item in materials if item['id']==material)
        assert 'content' not in stored
        fields('StoredMaterial',stored)
    assert 'content' not in schemas['StoredMaterial']['properties']
    assert 'id' not in schemas['MaterialInput']['properties']
    assert 'created' not in schemas['ReviewInput']['properties']
