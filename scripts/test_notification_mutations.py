"""Run meaningful template privacy and membership mutations in an isolated module."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile

root=Path(__file__).resolve().parents[1];source=(root/'apps/server/notifications.py').read_text()
mutations=[
 ('disabled_delivery',source.replace('if not (cfg.max_bot_enabled and cfg.max_outbound_enabled):return 0','if False:return 0')),
 ('missing_contact',source.replace("if (body.lessons or body.assignments) and (", "if False and (")),
 ('duplicate_enqueue',source.replace("if one(c,'SELECT id FROM reminder_deliveries WHERE id=?',(key,)):continue", "if False:continue").replace("key='reminder:'+hashlib.sha256", "key='reminder:'+str(time.time())+hashlib.sha256")),
 ('stale_delivery',source.replace("return (reminder['kind'],reminder['due_at']) in slots(c,user,preferences(c,user['id']),stamp)","return True")),
]

with tempfile.TemporaryDirectory() as tmp:
 for name,changed in mutations:
  if source==changed:raise SystemExit('FAIL: mutation anchor missing '+name)
  path=Path(tmp)/'broken.py';path.write_text(changed)
  plugin=Path(tmp)/'notification_mutation.py'
  plugin.write_text("import sys,types\nfrom pathlib import Path\ndef pytest_configure():\n m=types.ModuleType('apps.server.notifications');m.__package__='apps.server'\n"+f" m.__file__={str(root/'apps/server/notifications.py')!r}\n exec(compile(Path({str(path)!r}).read_text(),m.__file__,'exec'),m.__dict__)\n sys.modules['apps.server.notifications']=m\n")
  result=subprocess.run([sys.executable,'-m','pytest','tests/test_notifications.py','-p','notification_mutation','-q','--tb=short'],cwd=root,env={**os.environ,'PYTHONPATH':tmp+os.pathsep+str(root)},capture_output=True,timeout=30)
  if result.returncode!=1 or not (b'AssertionError' in result.stdout or b'E   assert ' in result.stdout):raise SystemExit('FAIL: mutation not caught '+name)
  print('PASS: detected '+name)
