import hashlib
import hmac
import json
import time
import re
from urllib.parse import parse_qsl


def token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def verify_max(init_data: str, bot_token: str, now=None):
    """Official MAX double HMAC; fresh launch only, duplicate keys rejected."""
    if not bot_token:
        raise ValueError('MAX authentication is not configured')
    if len(init_data)>20000 or re.search(r'%(?![0-9a-fA-F]{2})',init_data):
        raise ValueError('Malformed launch data')
    pairs = parse_qsl(init_data, keep_blank_values=True, strict_parsing=True, errors='strict', max_num_fields=50)
    if len({k for k, _ in pairs}) != len(pairs):
        raise ValueError('Duplicate launch parameter')
    data = dict(pairs)
    supplied = data.pop('hash', '')
    secret = hmac.digest(b'WebAppData', bot_token.encode(), 'sha256')
    message = '\n'.join(f'{k}={v}' for k, v in sorted(data.items()))
    expected = hmac.new(secret, message.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, supplied):
        raise ValueError('Invalid signature')
    age = (time.time() if now is None else now) - int(data.get('auth_date', '0'))
    if age < -30 or age > 300:
        raise ValueError('Expired launch data')
    user = json.loads(data['user'])
    if not isinstance(user,dict):
        raise ValueError('Invalid user')
    if type(user.get('id')) is not int or user['id'] <= 0:
        raise ValueError('Invalid user')
    return str(user['id'])


def verify_telegram(init_data: str, bot_token: str, now=None):
    # Telegram bot-token validation uses the same documented WebAppData HMAC.
    # Namespace is mandatory: identical numeric MAX/TG IDs are different people.
    return 'telegram:' + verify_max(init_data, bot_token, now)
