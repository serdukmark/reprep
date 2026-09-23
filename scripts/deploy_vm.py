"""Prepare offline by default; --apply deploys to the owner's authorized VM."""
import argparse
import os
from pathlib import Path
import shlex
import subprocess
import tarfile
import tempfile
import time
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
HOST = 'root@2.26.49.28'
DOMAIN = 'reprep.2-26-49-28.nip.io'
KEY = Path.home()/'.ssh/jarvis_vm_ed25519'
FILES = ['Dockerfile', '.dockerignore', 'requirements.txt', 'package.json',
         'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'apps',
         'infra/vm', 'scripts/check_public.py', 'scripts/vm_apply.py']


def package(target):
    with tarfile.open(target, 'w:gz') as archive:
        def safe(info):
            parts = Path(info.name).parts
            if '__pycache__' in parts or info.name.endswith(('.pyc', '.sqlite3')):
                return None
            if info.issym() or info.islnk():
                raise ValueError('Symlinks are not allowed in deployment package')
            return info
        for name in FILES:
            archive.add(ROOT/name, arcname=name, filter=safe)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    release = time.strftime('%Y%m%d-%H%M%S', time.gmtime())
    env = {}
    for line in (ROOT/'.env').read_text().splitlines():
        if '=' in line and not line.lstrip().startswith('#'):
            k, v = line.split('=', 1); env[k.strip()] = v.strip()
    origin = urlsplit(env.get('PUBLIC_BASE_URL', 'https://' + DOMAIN))
    if origin.scheme != 'https' or not origin.hostname or origin.port or origin.username or origin.password or origin.query or origin.fragment or origin.path not in ('', '/'):
        raise ValueError('PUBLIC_BASE_URL must be an HTTPS origin')
    domain = origin.hostname
    if not env.get('MAX_BOT_TOKEN'):
        raise ValueError('MAX_BOT_TOKEN missing')
    if not KEY.is_file(): raise ValueError('SSH key missing')
    ca = Path(env['MAX_CA_BUNDLE']).expanduser() if env.get('MAX_CA_BUNDLE') else None
    if ca and not ca.is_file(): raise ValueError('Configured CA bundle missing')
    # No network, image builds, SSH or MAX calls in preparation mode.
    subprocess.run(['python3', 'scripts/check_secrets.py'], cwd=ROOT, check=True)
    subprocess.run(['docker', 'compose', '-f', 'infra/vm/compose.yaml', 'config', '-q'], cwd=ROOT,
                   env={**os.environ, 'REPREP_RELEASE': release, 'REPREP_BIND_PORT': '8030'}, check=True)
    with tempfile.TemporaryDirectory(prefix='reprep-deploy-') as tmp:
        folder = Path(tmp)
        package(folder/'release.tgz')
        if not args.apply:
            print('Локальная подготовка пройдена. VM/Docker/Caddy на сервере, HTTPS и MAX ещё не проверены.')
            print('После восстановления доступа: .venv/bin/python scripts/deploy_vm.py --apply')
            return 0
        (folder/'.env').write_text((ROOT/'.env').read_text()); (folder/'.env').chmod(0o600)
        (folder/'max-ca.pem').write_bytes(ca.read_bytes() if ca else b'')
        ssh = ['ssh', '-i', str(KEY), '-o', 'IdentityAgent=none', '-o', 'IdentitiesOnly=yes',
               '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10', HOST]
        subprocess.run(ssh + ['docker compose version >/dev/null && systemctl is-active --quiet caddy && command -v python3 >/dev/null'], check=True)
        destination = '/opt/reprep/releases/' + release
        # Never overwrite an existing release or deploy from a user's working tree.
        subprocess.run(ssh + [shlex.join(['mkdir', '-p', '/opt/reprep/releases'])], check=True)
        subprocess.run(ssh + [shlex.join(['mkdir', '-m', '700', destination])], check=True)
        scp = ['scp', '-q', '-i', str(KEY), '-o', 'IdentityAgent=none', '-o', 'IdentitiesOnly=yes',
               '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10']
        subprocess.run(scp + [str(folder/'release.tgz'), str(folder/'.env'), str(folder/'max-ca.pem'),
                             HOST+':'+destination+'/'], check=True)
        command = 'cd ' + shlex.quote(destination) + ' && tar xzf release.tgz && python3 scripts/vm_apply.py ' + shlex.join([domain, '8030'])
        subprocess.run(ssh + [command], check=True)
        # Independent check from the Mac; a local network failure is not success.
        subprocess.run([str(ROOT/'.venv/bin/python'), 'scripts/check_public.py', '--url', 'https://'+domain, '--human'], cwd=ROOT, check=True)
        print('https://' + domain + '/')
    return 0


if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except Exception:
        print('Подготовка/выкатка НЕ завершена. Проверьте последний этап; секреты и тела ответов не выводятся.')
        raise SystemExit(1)
