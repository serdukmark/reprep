import hashlib,hmac,json,time
from urllib.parse import urlencode
import pytest
from apps.server import config
from apps.server.auth import verify_max
from apps.server.max_bot import webhook_secret


def test_env_rotation_is_not_cached_or_read_from_legacy_token_file(tmp_path,monkeypatch):
    monkeypatch.setattr(config,'__file__',str(tmp_path/'apps/server/config.py'))
    for key in ('ACCOUNT_DELETION_APPROVED','MAX_BOT_TOKEN','MAX_WEBHOOK_SECRET','MAX_BOT_ID','MAX_BOT_ENABLED','MAX_OUTBOUND_ENABLED','AI_ADAPTER_URL','APP_ENV','DEMO_ENABLED'):
        monkeypatch.delenv(key,raising=False)
    (tmp_path/'token.txt').write_text('synthetic-legacy-secret')
    path=tmp_path/'.env';path.write_text('MAX_BOT_TOKEN=synthetic-old-secret\n')
    old=config.Settings.load();assert old.bot_token=='synthetic-old-secret'
    assert 'MAX_BOT_TOKEN' not in config.os.environ
    path.write_text('MAX_BOT_TOKEN=synthetic-new-secret\nACCOUNT_DELETION_APPROVED=true\n')
    new=config.Settings.load();assert new.bot_token=='synthetic-new-secret'
    assert new.account_deletion_approved and 'ACCOUNT_DELETION_APPROVED' not in config.os.environ
    assert webhook_secret(old)!=webhook_secret(new)
    data={'auth_date':str(int(time.time())),'user':json.dumps({'id':123})}
    raw='\n'.join(k+'='+data[k] for k in sorted(data))
    digest=hmac.new(hmac.digest(b'WebAppData',old.bot_token.encode(),'sha256'),raw.encode(),hashlib.sha256).hexdigest()
    signed=urlencode({**data,'hash':digest})
    assert verify_max(signed,old.bot_token)
    with pytest.raises(ValueError):verify_max(signed,new.bot_token)
    monkeypatch.setenv('MAX_BOT_TOKEN','synthetic-container-secret')
    assert config.Settings.load().bot_token=='synthetic-container-secret'


def test_settings_repr_never_displays_credentials():
    values={key:'synthetic-private-'+key for key in ('bot_token','max_webhook_secret','ai_key','openrouter_key')}
    rendered=repr(config.Settings(**values))
    assert all(secret not in rendered for secret in values.values())
