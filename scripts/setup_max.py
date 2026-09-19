"""Offline validation by default. --apply changes MAX subscription: morning only."""
import argparse
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from apps.server.config import Settings
from apps.server.max_bot import MaxAPI,public_origin,webhook_secret


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--apply',action='store_true',help='Get bot identity and enable replies locally; performs external calls')
    args=parser.parse_args()
    cfg=Settings.load()
    try:
        origin=public_origin(cfg.public_base_url)
        if not cfg.bot_token: raise ValueError('MAX_BOT_TOKEN is empty')
    except ValueError:
        raise SystemExit('Configuration incomplete: set MAX_BOT_TOKEN and HTTPS PUBLIC_BASE_URL in .env. No network calls made.')
    if not args.apply:
        print('PASS: token present and HTTPS origin valid. No network calls. Bot registration and TLS are NOT verified.')
        return
    try:
        client=MaxAPI(cfg)
        info=client.request('GET','/me')
        bot_id=info.get('user_id')
        if type(bot_id) is not int or bot_id<=0: raise RuntimeError('Invalid bot identity')
        # Prepare the local receiver first; registration must not race a disabled endpoint.
        env=Path(__file__).resolve().parents[1]/'.env'
        lines=env.read_text().splitlines() if env.exists() else []
        updates={'MAX_BOT_ID':str(bot_id),'MAX_BOT_ENABLED':'true','MAX_OUTBOUND_ENABLED':'true'}
        for key,value in updates.items():
            lines=[line for line in lines if line.split('=',1)[0].strip()!=key]+[key+'='+value]
        env.write_text('\n'.join(lines)+'\n');env.chmod(0o600)
        print('Bot identity stored locally. Restart the app, then run setup_max_subscription.py when HTTPS is reachable. No subscription created yet.')
    except Exception:
        raise SystemExit('MAX setup failed. Check token, network and trusted CA. No upstream body printed.')

if __name__=='__main__':main()
