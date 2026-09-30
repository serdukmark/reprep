"""Explicit deployment operations; never run from application startup."""
import argparse
from .config import Settings
from .max_bot import MaxAPI, public_origin, webhook_secret

TYPES = {'bot_started', 'message_created'}


def identity(cfg, api=None):
    if not cfg.bot_token:
        raise ValueError('MAX_BOT_TOKEN is missing')
    value = (api or MaxAPI(cfg)).request('GET', '/me').get('user_id')
    if type(value) is not int or value <= 0:
        raise ValueError('Invalid bot identity')
    return value


def subscription_present(cfg, api):
    target = public_origin(cfg.public_base_url) + '/api/max/webhook'
    entries = api.request('GET', '/subscriptions').get('subscriptions', [])
    return any(isinstance(s, dict) and s.get('url') == target
               and TYPES.issubset(set(s.get('update_types') or [])) for s in entries)


def register(cfg, api=None):
    if not cfg.max_bot_enabled or not cfg.max_outbound_enabled or not cfg.max_bot_id:
        raise ValueError('MAX receiver and outbound must be enabled')
    api = api or MaxAPI(cfg)
    if identity(cfg, api) != cfg.max_bot_id:
        raise ValueError('Bot identity mismatch')
    target = public_origin(cfg.public_base_url) + '/api/max/webhook'
    # Reapply same URL to update its secret; do not delete other subscriptions.
    if api.request('POST', '/subscriptions', json={
        'url': target, 'update_types': sorted(TYPES), 'secret': webhook_secret(cfg)
    }).get('success') is not True:
        raise ValueError('Registration rejected')
    if not subscription_present(cfg, api):
        raise ValueError('Subscription read-back failed')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['identity', 'register', 'verify', 'preflight'])
    args = parser.parse_args()
    try:
        cfg = Settings.load()
        if args.action == 'identity':
            print(identity(cfg))  # Public bot ID only, never API response/body.
        elif args.action == 'preflight':
            from scripts.check_public import check
            result = check(cfg.public_base_url)
            blockers = [item['check'] for item in result['checks'] if not item['passed']]
            # APP_ENV=demo is the explicit public demo stand: synthetic demo accounts next to MAX sign-in.
            if cfg.environment not in ('production', 'demo') or (cfg.demo and cfg.environment != 'demo'): blockers.append('production_configuration')
            if not cfg.max_bot_enabled or not cfg.max_outbound_enabled: blockers.append('bot_disabled')
            try:
                api = MaxAPI(cfg)
                if identity(cfg, api) != cfg.max_bot_id: blockers.append('bot_identity')
                if not subscription_present(cfg, api): blockers.append('webhook_subscription')
            except Exception:
                blockers.append('max_api_unavailable')
            if blockers:
                print('К публикации НЕ ГОТОВО: ' + ', '.join(blockers))
                return 1
            print('Готов к публикации: технические проверки пройдены. Вход пользователя MAX и AI-сценарий требуют живого прогона.')
        else:
            if args.action == 'register':
                register(cfg)
            else:
                if not subscription_present(cfg, MaxAPI(cfg)):
                    raise ValueError('Subscription missing')
            print('MAX subscription confirmed; real user delivery not tested.')
    except Exception:
        print('MAX deployment step failed: check configuration, API connectivity and trusted CA.')
        return 1
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
