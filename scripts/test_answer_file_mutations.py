"""Assert that file privacy/original preservation tests reject intentional faults."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile

root=Path(__file__).resolve().parents[1]
source=(root/'apps/server/main.py').read_text()
mutations=[
    ('file_replay',source.replace(" or file_data(c,'submission_files','submission_id',s['id'])!=files",''),'test_attachment_draft_submit_replay_return_and_immutable_history'),
    ('missing_context',source.replace("answers[task_id]=answers.get(task_id,'')+'\\n[Приложенный текст решения]\\n'+file['content']","answers[task_id]=answers.get(task_id,'')"),'test_ai_context_includes_file_but_stored_answer_stays_original'),
    ('wrong_task',source.replace('        check_attachments(a,body.attachments)','        pass # broken file scope'),'test_attachment_validation_and_revision_conflicts'),
]
with tempfile.TemporaryDirectory() as tmp:
    for name,changed,test in mutations:
        if source==changed:raise SystemExit('FAIL: missing mutation anchor '+name)
        path=Path(tmp)/'broken_main.py';path.write_text(changed)
        plugin=Path(tmp)/'file_mutation.py'
        plugin.write_text("import types\nfrom pathlib import Path\ndef pytest_collection_modifyitems(items):\n m=types.ModuleType('apps.server.main');m.__package__='apps.server'\n"+f" m.__file__={str(root/'apps/server/main.py')!r}\n exec(compile(Path({str(path)!r}).read_text(),m.__file__,'exec'),m.__dict__)\n"+" import tests.test_workflow as fixtures\n fixtures.create_app=m.create_app\n")
        result=subprocess.run([sys.executable,'-m','pytest','tests/test_answer_files.py::'+test,'-p','file_mutation','-q','--tb=short'],cwd=root,env={**os.environ,'PYTHONPATH':tmp+os.pathsep+str(root)},capture_output=True,timeout=30)
        if result.returncode!=1 or b'AssertionError' not in result.stdout:raise SystemExit('FAIL: mutation not caught '+name)
        print('PASS: detected '+name)
