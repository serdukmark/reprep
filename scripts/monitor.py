"""Read-only availability probe. No credentials, message sending or automatic restarts."""
import argparse
import json
import sys
import time
from urllib.parse import urlsplit
import httpx


def probe(base_url,client=None):
    parsed=urlsplit(base_url)
    if parsed.scheme not in ('http','https') or not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment or parsed.path not in ('','/'):
        raise ValueError('Expected a server origin without credentials or path')
    started=time.monotonic()
    try:
        if client is None:
            with httpx.Client(timeout=5,follow_redirects=False,trust_env=False) as active:
                response=active.get(base_url.rstrip('/')+'/api/ready')
        else:response=client.get(base_url.rstrip('/')+'/api/ready',timeout=5,follow_redirects=False)
        body=response.json()
        healthy=response.status_code==200 and isinstance(body,dict) and body.get('ready') is True and 'database' in body.get('checks',[])
        reason='ok' if healthy else 'not_ready'
    except Exception:
        healthy=False;reason='unreachable_or_invalid_response'
    return {'healthy':healthy,'reason':reason,'duration_ms':round((time.monotonic()-started)*1000),'external_services':'not_probed'}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url',default='http://127.0.0.1:8000')
    parser.add_argument('--count',type=int,default=1)
    parser.add_argument('--interval',type=float,default=30)
    args=parser.parse_args()
    if not 1<=args.count<=10000 or args.interval<1:parser.error('count: 1..10000; interval: >=1 second')
    failed=False
    for i in range(args.count):
        try:result=probe(args.url)
        except ValueError:parser.error('Invalid origin (credentials and paths are forbidden)')
        print(json.dumps(result),flush=True);failed|=not result['healthy']
        if i+1<args.count:time.sleep(args.interval)
    return 1 if failed else 0

if __name__=='__main__':sys.exit(main())
