"""Missing preference fields must not overwrite another tab's setting."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    Path(tmp, 'notification_mutation.py').write_text(
        "def pytest_configure(config):\n"
        " from apps.server.notifications import NotificationInput\n"
        " original = NotificationInput.model_dump\n"
        " def broken(self, **kwargs):\n"
        "  kwargs['exclude_unset'] = False\n"
        "  return original(self, **kwargs)\n"
        " NotificationInput.model_dump = broken\n"
    )
    report = Path(tmp, 'results.xml')
    result = subprocess.run([sys.executable, '-m', 'pytest', 'tests/test_notification_patch.py',
        '-p', 'notification_mutation', '-q', '--tb=short', f'--junitxml={report}'], cwd=root,
        env={**os.environ, 'PYTHONPATH':tmp + os.pathsep + str(root)}, capture_output=True, timeout=60)
    cases = ET.parse(report).findall('.//testcase') if report.exists() else []
    if result.returncode != 1 or len(cases) != 2 or not all(case.find('failure') is not None and case.find('failure').get('message', '').startswith('assert ') for case in cases):
        raise SystemExit('FAIL: preference overwrite not detected in both cases')
    print('PASS: concurrent preference loss and unrelated opt-out both detected')
