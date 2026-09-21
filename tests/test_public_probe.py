import httpx
import pytest
from scripts.check_public import check

ORIGIN = 'https://class.example.org'


def response(request):
    path = request.url.path
    if path == '/api/ready':
        return httpx.Response(200, json={'ready': True, 'checks': ['database']})
    if path == '/assets/app.js':
        return httpx.Response(200, text='console.log(1)', headers={'content-type':'text/javascript'})
    if path == '/':
        return httpx.Response(200, text='<html><div id="root"></div><script src="/assets/app.js"></script></html>', headers={
            'content-type': 'text/html', 'content-security-policy': "default-src 'self'; frame-ancestors 'self' https://max.ru"})
    return httpx.Response(404 if path in ('/.env', '/api/auth/demo/tutor') else 401)


def probe(handler):
    with httpx.Client(transport=httpx.MockTransport(handler)) as client:
        return check(ORIGIN, client)


def test_good_fixture_does_not_claim_live_max_or_ai():
    result = probe(response)
    assert result['passed']
    assert result['real_max_login'] == result['webhook_registration'] == result['ai_scenario'] == 'not_tested'


@pytest.mark.parametrize('path,status', [('/api/ready', 503), ('/api/me', 200),
    ('/api/auth/max', 200), ('/api/max/webhook', 200), ('/api/max/webhook', 404),
    ('/api/auth/demo/tutor', 200), ('/.env', 200), ('/', 302)])
def test_broken_deployments_are_not_reported_as_success(path, status):
    result = probe(lambda req: httpx.Response(status, text='private-body-marker')
                   if req.url.path == path else response(req))
    assert not result['passed']
    assert 'private-body-marker' not in str(result)


def test_proxy_that_blocks_embedding_fails():
    def handler(req):
        r = response(req)
        r.headers['x-frame-options'] = 'DENY'
        return r
    assert not probe(handler)['passed']


def test_json_200_is_not_a_built_client():
    assert not probe(lambda req: httpx.Response(200, json={'message': 'Run npm build'})
                     if req.url.path == '/' else response(req))['passed']


def test_network_error_never_leaks_details():
    def handler(req):
        raise httpx.ConnectError('sensitive-error-marker')
    result = probe(handler)
    assert not result['passed']
    assert 'sensitive-error-marker' not in str(result)
    assert len(result['checks']) == 9


@pytest.mark.parametrize('origin', ['http://class.example.org', 'https://u:secret@example.org',
    'https://class.example.org/path', 'https://class.example.org?secret=1'])
def test_invalid_origins_fail_before_network(origin):
    with pytest.raises(ValueError):
        check(origin)


def test_real_application_auth_boundaries(tmp_path):
    from pathlib import Path
    from fastapi.testclient import TestClient
    from apps.server.config import Settings
    from apps.server.main import create_app
    if not Path('dist/index.html').exists():
        pytest.skip('Built client required; run npm run build first')
    cfg = Settings(database=str(tmp_path / 'probe.sqlite'), environment='production',
        bot_token='synthetic-public-probe-token', public_base_url=ORIGIN,
        max_bot_id=123, max_bot_enabled=True)
    with TestClient(create_app(cfg, run_worker=False), base_url=ORIGIN) as client:
        result = check(ORIGIN, client)
    assert result['passed'], result


def test_missing_javascript_cannot_pass_with_good_html():
    result = probe(lambda req: httpx.Response(404) if req.url.path == '/assets/app.js' else response(req))
    assert not result['passed']
    assert any(c['check'] == 'client_assets' and not c['passed'] for c in result['checks'])


def test_second_csp_policy_cannot_silently_block_max():
    def handler(req):
        r = response(req)
        if req.url.path == '/':
            r.headers = httpx.Headers([*r.headers.multi_items(),
                ('content-security-policy', "frame-ancestors 'none'")])
        return r
    assert not probe(handler)['passed']
