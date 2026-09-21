"""Mutate a private in-memory module; never modify the checkout or live server."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    root=Path(__file__).resolve().parents[1];source=(root/'apps/server/main.py').read_text()
    transition="draft=?,status='awaiting_review',lease_until=0"
    mutations=[(case,source.replace(transition,"draft=?,status='processing',lease_until=0"),'test_question_failure_goes_to_teacher['+case+']') for case in ('provider','schema','network')]
    mutations += [('draft_privacy',source.replace("q['draft'] and u['role']=='tutor'","q['draft']"),'test_question_bound_context_review_privacy_and_replay'),
                  ('cross_question',source.replace("WHERE id=? AND status='processing'","WHERE id!=? AND status='processing'"),'test_question_two_learners_and_teacher_race')]
    with tempfile.TemporaryDirectory() as tmp:
        for name,changed,test in mutations:
            if source==changed:raise SystemExit('FAIL: mutation anchor missing: '+name)
            path=Path(tmp)/'broken_main.py';path.write_text(changed)
            plugin=Path(tmp)/'question_mutation.py'
            plugin.write_text("import types\nfrom pathlib import Path\ndef pytest_collection_modifyitems(items):\n m=types.ModuleType('apps.server.main');m.__package__='apps.server'\n"+f" m.__file__={str(root/'apps/server/main.py')!r}\n exec(compile(Path({str(path)!r}).read_text(),m.__file__,'exec'),m.__dict__)\n"+" for item in items:\n  if item.module.__name__.endswith('test_questions'): item.module.create_app=m.create_app\n")
            result=subprocess.run([sys.executable,'-m','pytest','tests/test_questions.py::'+test,'-p','question_mutation','-q','--tb=short'],cwd=root,env={**os.environ,'PYTHONPATH':tmp+os.pathsep+str(root)},capture_output=True,timeout=30)
            if result.returncode!=1 or b'AssertionError' not in result.stdout:raise SystemExit('FAIL: mutation not caught: '+name)
            print('PASS: detected '+name)


if __name__=='__main__':main()
