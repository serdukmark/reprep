"""Run meaningful template privacy and membership mutations in an isolated module."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile

root=Path(__file__).resolve().parents[1];source=(root/'apps/server/workspaces.py').read_text()
mutations=[
 ('revoked_member',source.replace('m.active=1','m.active IN (0,1)')),
 ('private_relationship',source.replace("('title','instructions','tasks','feedback_policy')","('title','instructions','tasks','feedback_policy','relationship_id')")),
 ('automatic_publication',source.replace(repr('INSERT INTO assignments(id,tutor_id,relationship_id,data,created) VALUES(?,?,?,?,?)'),repr("INSERT INTO assignments(id,tutor_id,relationship_id,status,data,created) VALUES(?,?,?,'published',?,?)"))),
]
with tempfile.TemporaryDirectory() as tmp:
 for name,changed in mutations:
  if source==changed:raise SystemExit('FAIL: mutation anchor missing '+name)
  path=Path(tmp)/'broken.py';path.write_text(changed)
  plugin=Path(tmp)/'workspace_mutation.py'
  plugin.write_text("import sys,types\nfrom pathlib import Path\ndef pytest_collection_modifyitems(items):\n m=types.ModuleType('apps.server.workspaces');m.__package__='apps.server'\n"+f" m.__file__={str(root/'apps/server/workspaces.py')!r}\n exec(compile(Path({str(path)!r}).read_text(),m.__file__,'exec'),m.__dict__)\n sys.modules['apps.server.workspaces']=m\n")
  result=subprocess.run([sys.executable,'-m','pytest','tests/test_workspaces.py::test_shared_templates_copy_to_own_learner_without_opening_private_source','-p','workspace_mutation','-q','--tb=short'],cwd=root,env={**os.environ,'PYTHONPATH':tmp+os.pathsep+str(root)},capture_output=True,timeout=30)
  if result.returncode!=1 or b'AssertionError' not in result.stdout:raise SystemExit('FAIL: mutation not caught '+name)
  print('PASS: detected '+name)
