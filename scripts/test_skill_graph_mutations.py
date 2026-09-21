"""Run meaningful template privacy and membership mutations in an isolated module."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile

root=Path(__file__).resolve().parents[1];source=(root/'apps/server/skill_graph.py').read_text()
mutations=[
 ('cyclic_graph',source.replace('try:tuple(TopologicalSorter(graph).static_order())','try:tuple(graph)')),
 ('unconfirmed_prerequisites',source.replace(".get('latest')=='correct'", ".get('latest')!='incorrect'")),
]

with tempfile.TemporaryDirectory() as tmp:
 for name,changed in mutations:
  if source==changed:raise SystemExit('FAIL: mutation anchor missing '+name)
  path=Path(tmp)/'broken.py';path.write_text(changed)
  plugin=Path(tmp)/'graph_mutation.py'
  plugin.write_text("import sys,types\nfrom pathlib import Path\ndef pytest_collection_modifyitems(items):\n m=types.ModuleType('apps.server.skill_graph');m.__package__='apps.server'\n"+f" m.__file__={str(root/'apps/server/skill_graph.py')!r}\n exec(compile(Path({str(path)!r}).read_text(),m.__file__,'exec'),m.__dict__)\n sys.modules['apps.server.skill_graph']=m\n")
  result=subprocess.run([sys.executable,'-m','pytest','tests/test_skill_graph.py','-p','graph_mutation','-q','--tb=short'],cwd=root,env={**os.environ,'PYTHONPATH':tmp+os.pathsep+str(root)},capture_output=True,timeout=30)
  if result.returncode!=1 or not (b'AssertionError' in result.stdout or b'E   assert ' in result.stdout):raise SystemExit('FAIL: mutation not caught '+name)
  print('PASS: detected '+name)
