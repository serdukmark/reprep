"""Confirm that independent-edit regression fails if absent fields overwrite stored state."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    Path(tmp, 'lesson_mutation.py').write_text(
        "def pytest_configure(config):\n"
        " from apps.server.models import LessonStatusPatch\n"
        " original = LessonStatusPatch.model_dump\n"
        " def broken(self, **kwargs):\n"
        "  result = original(self, **kwargs)\n"
        "  result.setdefault('payment_status', 'unknown')\n"
        "  result.setdefault('status', 'scheduled')\n"
        "  return result\n"
        " LessonStatusPatch.model_dump = broken\n"
    )
    report = Path(tmp, 'results.xml')
    result = subprocess.run([sys.executable, '-m', 'pytest', 'tests/test_lesson_patch.py',
        '-p', 'lesson_mutation', '-q', '--tb=short', f'--junitxml={report}'], cwd=root,
        env={**os.environ, 'PYTHONPATH':tmp + os.pathsep + str(root)}, capture_output=True, timeout=60)
    cases = ET.parse(report).findall('.//testcase') if report.exists() else []
    if result.returncode != 1 or len(cases) != 1 or cases[0].find('failure') is None or 'AssertionError' not in (cases[0].find('failure').text or ''):
        raise SystemExit('FAIL: independent edit mutation was not detected')
    print('PASS: overwriting omitted lesson fields is detected')
