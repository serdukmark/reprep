from unittest.mock import Mock
import pytest
from apps.server.config import Settings
from apps.server.deployment import identity, register, subscription_present


def cfg():
    return Settings(bot_token='synthetic-deployment-token', max_bot_id=123,
        max_bot_enabled=True, max_outbound_enabled=True, public_base_url='https://class.example.org')


def api_fixture(**changes):
    values = {'id':123, 'success':True, 'url':'https://class.example.org/api/max/webhook',
              'types':['bot_started','message_created']}
    values.update(changes)
    def request(method, path, **kwargs):
        if path == '/me': return {'user_id':values['id']}
        if method == 'POST': return {'success':values['success']}
        return {'subscriptions':[{'url':values['url'],'update_types':values['types']}]}
    return Mock(request=Mock(side_effect=request))


def test_register_and_read_back():
    api=api_fixture();register(cfg(),api)
    calls=api.request.call_args_list
    assert [(c.args[0],c.args[1]) for c in calls] == [('GET','/me'),('POST','/subscriptions'),('GET','/subscriptions')]
    payload=calls[1].kwargs['json']
    assert len(payload['secret']) >= 5
    assert payload['secret'] != cfg().bot_token


@pytest.mark.parametrize('change',[{'id':True},{'id':999},{'success':False},
    {'url':'https://other.example.org/api/max/webhook'},{'types':['bot_started']}])
def test_failed_registration_cannot_pass(change):
    with pytest.raises(ValueError): register(cfg(),api_fixture(**change))


def test_disabled_receiver_never_registers():
    value=cfg();value.max_bot_enabled=False;api=api_fixture()
    with pytest.raises(ValueError): register(value,api)
    api.request.assert_not_called()


def test_release_package_excludes_environment_and_local_data(tmp_path):
    import tarfile
    from scripts.deploy_vm import package
    target=tmp_path/'release.tgz';package(target)
    with tarfile.open(target) as archive:
        names=archive.getnames()
    assert 'Dockerfile' in names
    assert 'scripts/check_public.py' in names
    assert 'scripts/vm_apply.py' in names
    assert 'apps/server/deployment.py' in names
    assert not any(n.startswith(('.env', '.git', 'data/', 'artifacts/')) or n.endswith('token.txt') for n in names)


def test_preflight_reports_missing_subscription(monkeypatch, capsys):
    import apps.server.deployment as module
    monkeypatch.setattr('sys.argv', ['deployment', 'preflight'])
    monkeypatch.setattr(module.Settings, 'load', lambda: cfg())
    monkeypatch.setattr(module, 'MaxAPI', lambda _: api_fixture(url='https://other.example.org/hook'))
    monkeypatch.setattr('scripts.check_public.check', lambda _: {'checks': []})
    assert module.main() == 1
    output=capsys.readouterr().out
    assert 'webhook_subscription' in output
    assert 'production_configuration' in output
    assert cfg().bot_token not in output


def test_preflight_success_has_limited_claim(monkeypatch, capsys):
    import apps.server.deployment as module
    value=cfg();value.environment='production'
    monkeypatch.setattr('sys.argv', ['deployment', 'preflight'])
    monkeypatch.setattr(module.Settings, 'load', lambda: value)
    monkeypatch.setattr(module, 'MaxAPI', lambda _: api_fixture())
    monkeypatch.setattr('scripts.check_public.check', lambda _: {'checks': [{'check':'client_html','passed':True}]})
    assert module.main() == 0
    assert 'требуют живого прогона' in capsys.readouterr().out
