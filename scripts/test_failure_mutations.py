"""Each adverse scenario must fail against an intentionally broken queue.

Only an in-memory copy is changed. The working tree and running server are untouched.
"""
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def main():
    root=Path(__file__).resolve().parents[1]
    source=(root/'apps/server/main.py').read_text()
    cases=['connect','http_503','http_429','read_disconnect','read_timeout','empty','garbage','schema','envelope','context_limit']
    transition="analysis=?,status='awaiting_review',lease_until=0"
    mutations=[(case,source.replace(transition,"analysis=?,status='processing',lease_until=0"),
                'test_fault_keeps_original_and_reaches_manual_review['+case+']') for case in cases]
    mutations += [
        ('context_guard_removed',source.replace('>60000:', '>6000000:'),
         'test_fault_keeps_original_and_reaches_manual_review[context_limit]'),
        ('answer_erased',source.replace(transition,"answers='{}',analysis=?,status='awaiting_review',lease_until=0"),
         'test_fault_keeps_original_and_reaches_manual_review[connect]'),
        ('cross_job_update',source.replace("WHERE id=? AND status='processing'", "WHERE id!=? AND status='processing'"),
         'test_two_simultaneous_learners_keep_separate_jobs'),
    ]
    with tempfile.TemporaryDirectory() as tmp:
        for name,changed,test in mutations:
            if changed==source: raise SystemExit('FAIL: mutation anchor missing: '+name)
            path=Path(tmp)/'broken_main.py';path.write_text(changed)
            plugin=Path(tmp)/'fault_mutation.py'
            plugin.write_text(
                "import types\nfrom pathlib import Path\ndef pytest_collection_modifyitems(items):\n"
                " m=types.ModuleType('apps.server.main');m.__package__='apps.server'\n"
                f" m.__file__={str(root/'apps/server/main.py')!r}\n"
                f" exec(compile(Path({str(path)!r}).read_text(),m.__file__,'exec'),m.__dict__)\n"
                " for item in items:\n  if item.module.__name__.endswith('test_failure_paths'): item.module.create_app=m.create_app\n")
            run=subprocess.run([sys.executable,'-m','pytest','tests/test_failure_paths.py::'+test,
                                '-p','fault_mutation','-q','--tb=short'],cwd=root,
                               env={**os.environ,'PYTHONPATH':tmp+os.pathsep+str(root)},capture_output=True,timeout=30)
            if run.returncode!=1 or b'AssertionError' not in run.stdout or b'FAILED' not in run.stdout:
                raise SystemExit('FAIL: contract did not catch mutation: '+name)
            print('PASS: detected '+name)


if __name__=='__main__': main()
