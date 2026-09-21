"""Check an authorized public deployment without credentials or valid MAX events.

Does NOT prove real MAX login, webhook delivery or the AI learning scenario.
"""
import argparse
import json
import re
from html.parser import HTMLParser
from urllib.parse import urlsplit
import httpx


def check(origin, client=None):
    parsed = urlsplit(origin)
    if (parsed.scheme != 'https' or not parsed.hostname or parsed.username
            or parsed.password or parsed.query or parsed.fragment
            or parsed.path not in ('', '/') or parsed.port not in (None, 443)):
        raise ValueError('Expected HTTPS origin on port 443 without credentials')
    origin = origin.rstrip('/')
    if client is None:
        # Standard CA verification stays enabled. Never follow redirects to a
        # login page or another host and mistake it for this application's API.
        with httpx.Client(timeout=8, follow_redirects=False, trust_env=False) as active:
            return check(origin, active)
    results = []

    def run(name, method, path, predicate, **kwargs):
        try:
            response = client.request(method, origin + path, **kwargs)
            passed = bool(predicate(response))
            results.append({'check': name, 'passed': passed, 'status': response.status_code})
        except Exception:
            # No response bodies, user content, URLs or exception strings in logs.
            results.append({'check': name, 'passed': False, 'reason': 'network_or_invalid_response'})

    run('database_ready', 'GET', '/api/ready', lambda r: r.status_code == 200
        and r.json().get('ready') is True and 'database' in r.json().get('checks', []))
    run('client_html', 'GET', '/', lambda r: r.status_code == 200
        and 'text/html' in r.headers.get('content-type', '') and 'id="root"' in r.text)
    class Scripts(HTMLParser):
        def __init__(self):
            super().__init__(); self.sources = []
        def handle_starttag(self, tag, attrs):
            if tag == 'script':
                source = dict(attrs).get('src', '')
                if source: self.sources.append(source)

    def assets_ready(response):
        if response.status_code != 200: return False
        parser = Scripts(); parser.feed(response.text)
        if not parser.sources: return False
        for source in parser.sources:
            if not re.fullmatch(r'/assets/[A-Za-z0-9_.-]+\.js', source): return False
            asset = client.request('GET', origin + source)
            if asset.status_code != 200 or not asset.content or 'javascript' not in asset.headers.get('content-type', ''):
                return False
        return True
    run('client_assets', 'GET', '/', assets_ready)
    def embedding_allowed(response):
        if response.status_code != 200 or response.headers.get('x-frame-options'): return False
        seen = False
        # Browsers enforce every CSP policy, not the union of their permissions.
        for value in response.headers.get_list('content-security-policy'):
            for policy in value.split(','):
                for directive in policy.split(';'):
                    tokens = directive.split()
                    if tokens and tokens[0] == 'frame-ancestors':
                        seen = True
                        if 'https://max.ru' not in tokens or "'none'" in tokens: return False
        return seen
    run('max_embedding_headers', 'GET', '/', embedding_allowed)
    run('anonymous_access_denied', 'GET', '/api/me', lambda r: r.status_code == 401)
    run('demo_disabled', 'POST', '/api/auth/demo/tutor', lambda r: r.status_code == 404)
    run('forged_max_login_denied', 'POST', '/api/auth/max', lambda r: r.status_code == 401,
        json={'init_data': 'auth_date=1&user=%7B%22id%22%3A1%7D&hash=invalid',
              'role': 'learner', 'alias': 'Синтетическая проверка'})
    run('forged_webhook_denied', 'POST', '/api/max/webhook', lambda r: r.status_code == 401,
        headers={'X-Max-Bot-Api-Secret': 'invalid-public-probe'}, json={})
    # 404 from a disabled webhook is deliberately a failure: this is a MAX deployment check.
    run('env_not_served', 'GET', '/.env', lambda r: r.status_code in (403, 404))
    return {'passed': all(r['passed'] for r in results), 'checks': results,
            'real_max_login': 'not_tested', 'webhook_registration': 'not_tested',
            'ai_scenario': 'not_tested'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', required=True)
    parser.add_argument('--human', action='store_true')
    args = parser.parse_args()
    try:
        result = check(args.url)
    except ValueError:
        parser.error('Use an HTTPS origin on port 443 without credentials, path or query')
    if args.human:
        print('Техническая проверка публикации пройдена' if result['passed'] else 'К публикации НЕ ГОТОВО')
        for item in result['checks']:
            if not item['passed']:
                print('- ' + item['check'] + ': ' + str(item.get('status', item.get('reason'))))
        print('Реальный вход MAX, регистрация webhook и AI-сценарий этой командой не подтверждаются.')
    else:
        print(json.dumps(result, ensure_ascii=False))
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
