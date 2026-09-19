"""Explicit morning operation; never called during app startup."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from apps.server.config import Settings
from apps.server.max_bot import MaxAPI,public_origin,webhook_secret

if __name__=='__main__':
    if sys.argv[1:]!=['--apply']:
        raise SystemExit('No action. --apply registers an external webhook; run only after owner authorization.')
    cfg=Settings.load()
    try:
        origin=public_origin(cfg.public_base_url)
        if not cfg.max_bot_enabled or not cfg.max_bot_id or not cfg.bot_token: raise ValueError()
        result=MaxAPI(cfg).request('POST','/subscriptions',json={'url':origin+'/api/max/webhook','update_types':['bot_started','message_created'],'secret':webhook_secret(cfg)})
        if result.get('success') is not True: raise ValueError()
        print('Webhook registered. Enable MAX_OUTBOUND_ENABLED only for the authorized real bot test; MiniApp URL still must be set in MAX partner settings.')
    except Exception:
        raise SystemExit('Registration failed. Check HTTPS:443, full trusted TLS chain, token and CA bundle. No upstream body printed.')
