"""Authorized synthetic HTTPS rehearsal through Telegram auth; not a human Telegram launch.
Uses synthetic signed initData and private demo identities. Never sends Telegram messages.
"""
import hashlib,hmac,json,secrets,socket,time,sys
from pathlib import Path
from urllib.parse import urlencode
from unittest.mock import patch
import httpx
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from apps.server.config import Settings
from scripts import public_rehearsal as rehearsal


def main():
    if sys.argv[1:]!=['--apply']:raise SystemExit('Use --apply for private synthetic records and a live AI check.')
    cfg=Settings.load();original_remote=rehearsal.remote;created=[]
    def remote(source):
        result=original_remote(source)
        if not isinstance(result,dict) or 'tutor' not in result or 'tokens' not in result['tutor']:return result
        mapping={v['id']:str(900000000000000+secrets.randbelow(100000000)) for v in result.values()};created.extend(mapping)
        original_remote('''import json
from apps.server.db import connect
from apps.server.config import Settings
with connect(Settings.load().database) as db:
 for uid,identity in '''+repr(mapping)+'''.items():db.execute('UPDATE users SET external_id=? WHERE id=?',('telegram:'+identity,uid))
print('{}')''')
        with httpx.Client(timeout=12,trust_env=False) as client:
            for role,account in result.items():
                fields={'auth_date':str(int(time.time())),'user':json.dumps({'id':int(mapping[account['id']]),'first_name':'Synthetic HTTPS test'})}
                secret=hmac.digest(b'WebAppData',cfg.telegram_token.encode(),'sha256')
                fields['hash']=hmac.digest(secret,'\n'.join(k+'='+v for k,v in sorted(fields.items())).encode(),'sha256').hex()
                tokens=[]
                for _ in range(2):
                    response=client.post(rehearsal.ORIGIN+'/api/auth/telegram',json={'init_data':urlencode(fields),'role':'learner' if role.startswith('learner') else 'tutor','alias':'Synthetic'})
                    assert response.status_code==200 and response.json()['user']['id']==account['id']
                    tokens.append(response.json()['token'])
                account['tokens']=tokens
        return result
    original_resolve=socket.getaddrinfo
    def resolve(host,*args,**kw):return original_resolve('2.26.49.28' if host in ('reprep.2-26-49-28.nip.io',b'reprep.2-26-49-28.nip.io') else host,*args,**kw)
    try:
        with patch('socket.getaddrinfo',side_effect=resolve),patch.object(rehearsal,'remote',side_effect=remote):
            evidence=rehearsal.run('2.26.49.28')
        evidence['authentication']='Real HTTPS Telegram HMAC endpoint; operator-signed synthetic initData, not Telegram-client launch'
        evidence['limitations']=[x for x in evidence['limitations'] if 'not MAX authentication' not in x]+['Real Telegram client interaction not tested']
        Path('docs/evidence/telegram-learning-rehearsal.json').write_text(json.dumps(evidence,ensure_ascii=False,indent=2)+'\n')
        assert evidence['passed']
    finally:
        if created:original_remote('''import json
from apps.server.db import connect
from apps.server.config import Settings
with connect(Settings.load().database) as db:
 for uid in '''+repr(created)+''':db.execute('DELETE FROM sessions WHERE user_id=?',(uid,))
print('{}')''')

if __name__=='__main__':
    try:main()
    except Exception:raise SystemExit('Telegram synthetic rehearsal failed; no secret-bearing exceptions printed.')
