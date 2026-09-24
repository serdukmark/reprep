"""Exercise invitation retry guards in private modules, without editing live code."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
source = (root / 'apps/server/main.py').read_text()
actor = "if inv['accepted_by'] == u['id']:"
expiry = "if not inv or inv['state'] not in ('created', 'accepted') or inv['expires'] < time.time():"
mutations = [
    ('retry_denied', actor, 'if False:', 'test_same_learner_retries_accept_without_second_relationship'),
    ('foreign_replay', actor, 'if True:', 'test_another_learner_cannot_replay_consumed_invitation'),
    ('expired_replay', expiry, "if not inv or inv['state'] not in ('created', 'accepted'):", 'test_expired_consumed_invitation_is_not_a_replay_bypass'),
]
with tempfile.TemporaryDirectory(prefix='reprep-invite-mutations-') as tmp:
    for name, before, after, test in mutations:
        assert source.count(before) == 1, name
        path = Path(tmp) / 'broken_main.py'
        path.write_text(source.replace(before, after, 1))
        plugin = Path(tmp) / 'invitation_mutation.py'
        plugin.write_text(
            "import types\nfrom pathlib import Path\ndef pytest_collection_modifyitems(items):\n"
            " m=types.ModuleType('apps.server.main');m.__package__='apps.server'\n"
            f" m.__file__={str(root/'apps/server/main.py')!r}\n"
            f" exec(compile(Path({str(path)!r}).read_text(),m.__file__,'exec'),m.__dict__)\n"
            " import tests.test_workflow as fixtures\n fixtures.create_app=m.create_app\n"
        )
        report = Path(tmp) / 'results.xml'
        result = subprocess.run(
            [sys.executable, '-m', 'pytest', 'tests/test_invitation_retry.py::'+test,
             '-p', 'invitation_mutation', '-q', '--tb=no', f'--junitxml={report}'],
            cwd=root, env={**os.environ, 'PYTHONPATH':tmp+os.pathsep+str(root)},
            capture_output=True, timeout=60,
        )
        cases = ET.parse(report).findall('.//testcase') if report.exists() else []
        if result.returncode != 1 or len(cases) != 1 or cases[0].find('failure') is None:
            raise SystemExit('FAIL: mutation was not detected: '+name)
        print('PASS: detected '+name)
