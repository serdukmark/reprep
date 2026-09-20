"""Check ignored local configuration and Git-visible content without printing secrets."""
import re
import subprocess
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def git(*args):
    return subprocess.check_output(['git',*args],cwd=ROOT)

for name in ('.env','.env.local','token.txt'):
    if subprocess.run(['git','check-ignore','-q',name],cwd=ROOT).returncode:
        raise SystemExit('FAIL: local environment configuration is not ignored')
if any(x.startswith(b'.env') and x!=b'.env.example' for x in git('ls-files').splitlines()):
    raise SystemExit('FAIL: local environment configuration is tracked')
if git('ls-files','--','token.txt').strip() or git('log','--all','--format=%H','--','token.txt').strip():
    raise SystemExit('FAIL: token.txt entered Git; notify owner and revoke credential')
secrets=[]
if (ROOT/'token.txt').is_file():
    raw=(ROOT/'token.txt').read_bytes().strip()
    if raw: secrets.append(raw)
if (ROOT/'.env').exists():
    for line in (ROOT/'.env').read_text().splitlines():
        if '=' in line:
            k,v=line.split('=',1)
            if v and any(word in k for word in ('KEY','TOKEN','SECRET')):
                secrets.append(v.encode())
def unsafe(data):
    return any(s in data for s in secrets) or bool(re.search(rb'sk-or-v1-[A-Za-z0-9]{24,}',data))

paths=git('ls-files','--cached','--others','--exclude-standard','-z').split(b'\0')
for raw in paths:
    if not raw: continue
    p=ROOT/raw.decode()
    if p.is_file() and unsafe(p.read_bytes()):
        raise SystemExit('FAIL: secret-like content in '+str(p.relative_to(ROOT)))
for label,args in [('staged',('diff','--cached','--binary')),('working',('diff','--binary'))]:
    if unsafe(git(*args)):
        raise SystemExit('FAIL: secret-like content in '+label+' diff')
for line in git('rev-list','--objects','--all').splitlines():
    obj=line.split(b' ',1)[0].decode()
    if git('cat-file','-t',obj).strip()==b'blob' and unsafe(git('cat-file','blob',obj)):
        raise SystemExit('FAIL: secret in Git history; notify owner and revoke credential')
print('PASS: .env/.env.local/token.txt ignored; Git-visible files, diffs and history contain no configured secrets or OpenRouter keys.')
