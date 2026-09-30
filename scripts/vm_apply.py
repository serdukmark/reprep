"""Run on the authorized VM in an isolated release directory (root required)."""
import fcntl
import os
from pathlib import Path
import re
import subprocess
import sys
import time


def run(args, **kwargs):
    result = subprocess.run(args, capture_output=True, text=True, **kwargs)
    if result.returncode:
        # Do not echo environment files, upstream bodies or arbitrary CLI errors.
        raise RuntimeError('Command failed: ' + str(args[0]))
    return result.stdout.strip()


def apply(root, domain, port):
    if os.geteuid() != 0 or not re.fullmatch(r'[a-z0-9][a-z0-9.-]+', domain):
        raise ValueError('Root and a DNS hostname are required')
    if not 1024 <= port <= 65535 or root.parent != Path('/opt/reprep/releases'):
        raise ValueError('Invalid release path or port')
    current = Path('/opt/reprep/current')
    if current.exists() and not current.is_symlink():
        raise ValueError('Current path is not a managed symlink')
    os.chdir(root)
    release = root.name
    if not re.fullmatch(r'[a-zA-Z0-9_-]+', release):
        raise ValueError('Invalid release ID')
    os.environ.update(REPREP_RELEASE=release, REPREP_BIND_PORT=str(port))
    compose = ['docker', 'compose', '-f', 'infra/vm/compose.yaml']
    run(['docker', 'compose', 'version'])
    run(['systemctl', 'is-active', 'caddy'])
    run(['caddy', 'validate', '--config', '/etc/caddy/Caddyfile'])
    # A listener may only belong to an existing reprep Compose service.
    listeners = run(['ss', '-H', '-ltn', f'sport = :{port}'])
    existing = run(['docker', 'ps', '-q', '--filter', 'label=com.docker.compose.project=reprep',
                    '--filter', 'label=com.docker.compose.service=app'])
    if listeners and not existing:
        raise ValueError('Selected port already occupied')
    if listeners:
        mapping = run(['docker', 'port', existing, '8000/tcp'])
        if mapping != f'127.0.0.1:{port}':
            raise ValueError('Existing service uses another port')
    env = root / '.env'
    lines = env.read_text().splitlines()
    def update(values):
        nonlocal lines
        lines = [s for s in lines if s.split('=', 1)[0].strip() not in values]
        lines += [k + '=' + str(v) for k, v in values.items()]
        env.write_text('\n'.join(lines) + '\n'); env.chmod(0o600)
    update({'PUBLIC_BASE_URL': 'https://' + domain,
            'ALLOWED_WEB_ORIGINS': '', 'APP_ENV': 'production',
            'DEMO_ENABLED': 'false',
            'MAX_CA_BUNDLE': '/run/reprep-max-ca.pem' if (root/'max-ca.pem').stat().st_size else ''})
    print('Building client and server image', flush=True)
    run(compose + ['build'])
    image = 'reprep:' + release
    print('Checking MAX bot identity and trusted CA', flush=True)
    bot_id = run(['docker', 'run', '--rm', '--env-file', str(env),
                  '-v', str(root/'max-ca.pem')+':/run/reprep-max-ca.pem:ro',
                  image, 'python', '-m', 'apps.server.deployment', 'identity'])
    if not bot_id.isdecimal() or int(bot_id) <= 0:
        raise ValueError('MAX identity unavailable')
    update({'MAX_BOT_ID': bot_id, 'MAX_BOT_ENABLED': 'true', 'MAX_OUTBOUND_ENABLED': 'true'})
    run(['systemctl', 'enable', '--now', 'docker'])
    run(['systemctl', 'enable', 'caddy'])
    run(compose + ['up', '-d', '--no-build', '--wait', '--wait-timeout', '120'])
    print('Container healthy; configuring separate HTTPS site', flush=True)
    caddy = Path('/etc/caddy/Caddyfile')
    snippet = Path('/etc/caddy/reprep.caddy')
    original = caddy.read_text()
    previous = snippet.read_text() if snippet.exists() else None
    marker = 'import /etc/caddy/reprep.caddy'
    if domain in original:
        raise ValueError('Hostname already appears in unmanaged Caddy configuration')
    if previous is not None and not previous.startswith('# Managed by reprep deployment\n'):
        raise ValueError('Existing snippet is not managed by reprep')
    candidate = '# Managed by reprep deployment\n' + (root/'infra/vm/Caddyfile.example').read_text().replace('{$REPREP_DOMAIN}', domain).replace('{$REPREP_BIND_PORT}', str(port))
    (root/'caddy-before.txt').write_text(original)
    if caddy.read_text() != original:
        raise ValueError('Caddy was modified concurrently; rerun deployment')
    snippet.write_text(candidate)
    if marker not in original.splitlines():
        caddy.write_text(original.rstrip() + '\n\n' + marker + '\n')
    try:
        run(['caddy', 'validate', '--config', str(caddy)])
        run(['systemctl', 'reload', 'caddy'])
    except Exception:
        caddy.write_text(original)
        if previous is not None: snippet.write_text(previous)
        else: snippet.unlink()
        raise RuntimeError('Caddy configuration rejected; original configuration restored') from None
    # Certificate provisioning may take time. Each check has bounded HTTP timeouts.
    for attempt in range(6):
        try:
            run(compose + ['exec', '-T', 'app', 'python', 'scripts/check_public.py', '--url', 'https://'+domain])
            break
        except RuntimeError:
            if attempt == 5: raise RuntimeError('Public HTTPS checks failed; MAX subscription not changed') from None
            time.sleep(5)
    print('HTTPS checks passed; registering MAX webhook', flush=True)
    run(compose + ['exec', '-T', 'app', 'python', '-m', 'apps.server.deployment', 'register'])
    run(compose + ['exec', '-T', 'app', 'python', '-m', 'apps.server.deployment', 'preflight'])
    if any(line.strip() == 'TELEGRAM_BOT_ENABLED=true' for line in lines):
        print('Registering and verifying Telegram webhook', flush=True)
        run(compose + ['exec', '-T', 'app', 'python', '-m', 'apps.server.telegram_bot', 'setup'])
    current = Path('/opt/reprep/current')
    if current.exists() and not current.is_symlink():
        raise ValueError('Current path is not a managed symlink')
    temporary = Path('/opt/reprep/current.next')
    if temporary.is_symlink(): temporary.unlink()
    temporary.symlink_to(root)
    temporary.replace(current)
    print('https://' + domain + '/', flush=True)


if __name__ == '__main__':
    try:
        with open('/run/lock/reprep-deploy.lock', 'w') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
            apply(Path.cwd().resolve(), sys.argv[1], int(sys.argv[2]))
    except Exception as exc:
        # Only our fixed messages are safe; no secret-bearing subprocess output.
        print('Deployment failed; no readiness claim. Stage details: ' +
              (str(exc) if type(exc) in (ValueError, RuntimeError) else type(exc).__name__), file=sys.stderr)
        raise SystemExit(1)
