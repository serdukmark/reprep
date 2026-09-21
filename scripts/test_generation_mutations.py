"""Mutate a private in-memory module; never modify the checkout or live server."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    root=Path(__file__).resolve().parents[1];source=(root/'apps/server/main.py').read_text()
    mutations=[(case,source.replace("'completed' if aid else 'failed'", "'completed' if aid else 'processing'"),'test_failed_generation_preserves_material_without_publishing['+case+']') for case in ('provider','invalid','schema')]
    mutations += [('automatic_publication',source.replace(repr('INSERT INTO assignments(id,tutor_id,relationship_id,data,created) VALUES(?,?,?,?,?)'), repr("INSERT INTO assignments(id,tutor_id,relationship_id,status,data,created) VALUES(?,?,?,'published',?,?)")),'test_generation_requires_permission_and_only_creates_private_draft')]
    with tempfile.TemporaryDirectory() as tmp:
        for name,changed,test in mutations:
            if source==changed:raise SystemExit('FAIL: mutation anchor missing: '+name)
            path=Path(tmp)/'broken_main.py';path.write_text(changed)
            plugin=Path(tmp)/'generation_mutation.py'
            plugin.write_text("import types\nfrom pathlib import Path\ndef pytest_collection_modifyitems(items):\n m=types.ModuleType('apps.server.main');m.__package__='apps.server'\n"+f" m.__file__={str(root/'apps/server/main.py')!r}\n exec(compile(Path({str(path)!r}).read_text(),m.__file__,'exec'),m.__dict__)\n"+" import tests.test_questions as fixtures\n fixtures.create_app=m.create_app\n")
            result=subprocess.run([sys.executable,'-m','pytest','tests/test_generation.py::'+test,'-p','generation_mutation','-q','--tb=short'],cwd=root,env={**os.environ,'PYTHONPATH':tmp+os.pathsep+str(root)},capture_output=True,timeout=30)
            if result.returncode!=1 or b'AssertionError' not in result.stdout:raise SystemExit('FAIL: mutation not caught: '+name)
            print('PASS: detected '+name)


if __name__=='__main__':main()
