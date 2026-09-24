"""Disable create deduplication in an isolated test process; all ten tests must fail."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET


def main():
    root = Path(__file__).resolve().parents[1]
    with tempfile.TemporaryDirectory() as tmp:
        plugin = Path(tmp) / 'resource_retry_mutation.py'
        plugin.write_text(
            "def pytest_configure(config):\n"
            " import apps.server.service as service\n"
            " service.create_resource_id = lambda kind, actor, key: service.uid()\n"
        )
        report = Path(tmp) / 'results.xml'
        result = subprocess.run(
            [sys.executable, '-m', 'pytest', 'tests/test_resource_retry.py', 'tests/test_duplicate_retry.py',
             '-p', 'resource_retry_mutation', '-q', '--tb=short', f'--junitxml={report}'],
            cwd=root, env={**os.environ, 'PYTHONPATH': tmp + os.pathsep + str(root)},
            capture_output=True, timeout=60,
        )
        cases = ET.parse(report).findall('.//testcase') if report.exists() else []
        if result.returncode != 1 or len(cases) != 10 or not all(
            case.find('failure') is not None and 'AssertionError' in (case.find('failure').text or '')
            for case in cases
        ):
            raise SystemExit('FAIL: expected ten assertion failures after disabling deduplication')
        print('PASS: all five resource operations detect broken sequential and concurrent retry (10 mutations caught)')


if __name__ == '__main__':
    main()
