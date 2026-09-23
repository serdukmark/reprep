"""Prove retry regression detects broken idempotency without editing application files."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    root=Path(__file__).resolve().parents[1]
    source=(root/'apps/server/main.py').read_text()
    anchor="if body.client_id else uid()"
    assert anchor in source
    changed=source.replace(anchor,"if False else uid()",1)
    with tempfile.TemporaryDirectory() as tmp:
        path=Path(tmp)/'broken.py';path.write_text(changed)
        plugin=Path(tmp)/'create_retry_mutation.py'
        plugin.write_text("import types\nfrom pathlib import Path\ndef pytest_collection_modifyitems(items):\n m=types.ModuleType('apps.server.main');m.__package__='apps.server'\n"+f" m.__file__={str(root/'apps/server/main.py')!r}\n exec(compile(Path({str(path)!r}).read_text(),m.__file__,'exec'),m.__dict__)\n import tests.test_workflow as fixtures\n fixtures.create_app=m.create_app\n")
        result=subprocess.run([sys.executable,'-m','pytest','tests/test_create_retry.py','-p','create_retry_mutation','-q','--tb=short'],cwd=root,env={**os.environ,'PYTHONPATH':tmp+os.pathsep+str(root)},capture_output=True,timeout=30)
        if result.returncode!=1 or b'AssertionError' not in result.stdout:raise SystemExit('FAIL: mutation not detected')
        print('PASS: detected duplicate creation after lost response / concurrent retry')

if __name__=='__main__':main()
