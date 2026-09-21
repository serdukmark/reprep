"""Run meaningful catalog visibility and request consent mutations in an isolated module."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile

root=Path(__file__).resolve().parents[1];source=(root/'apps/server/marketplace.py').read_text()
mutations=[
 ('hidden_offer',source.replace("if offer['visible'] and offer['price_rub']<=max_price", "if offer['price_rub']<=max_price")),
 ('stale_terms',source.replace("if row['revision']!=body.offer_revision:", "if False:")),
 ('declined_reports_link',source.replace("relationship_id=None", "relationship_id='incorrect-automatic-link'")),
]

with tempfile.TemporaryDirectory() as tmp:
 for name,changed in mutations:
  if source==changed:raise SystemExit('FAIL: mutation anchor missing '+name)
  path=Path(tmp)/'broken.py';path.write_text(changed)
  plugin=Path(tmp)/'catalog_mutation.py'
  plugin.write_text("import sys,types\nfrom pathlib import Path\ndef pytest_collection_modifyitems(items):\n m=types.ModuleType('apps.server.marketplace');m.__package__='apps.server'\n"+f" m.__file__={str(root/'apps/server/marketplace.py')!r}\n exec(compile(Path({str(path)!r}).read_text(),m.__file__,'exec'),m.__dict__)\n sys.modules['apps.server.marketplace']=m\n")
  result=subprocess.run([sys.executable,'-m','pytest','tests/test_marketplace.py','-p','catalog_mutation','-q','--tb=short'],cwd=root,env={**os.environ,'PYTHONPATH':tmp+os.pathsep+str(root)},capture_output=True,timeout=30)
  if result.returncode!=1 or b'AssertionError' not in result.stdout:raise SystemExit('FAIL: mutation not caught '+name)
  print('PASS: detected '+name)
