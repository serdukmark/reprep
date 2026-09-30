"""A missing webhook auth scheme must be caught in the exported API contract."""
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import xml.etree.ElementTree as ET
root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    Path(tmp, 'schema_mutation.py').write_text(
        "def pytest_configure(config):\n"
        " import apps.server.openapi_contract as contract\n"
        " original = contract.enrich\n"
        " def broken(*args):\n"
        "  schema = original(*args)\n"
        "  schema['components']['securitySchemes'].pop('MaxWebhookSecret', None)\n"
        "  return schema\n"
        " contract.enrich = broken\n"
    )
    report = Path(tmp, 'results.xml')
    result = subprocess.run([sys.executable, '-m', 'pytest',
        'tests/test_openapi_contract.py::test_every_security_requirement_declares_its_scheme',
        '-p', 'schema_mutation', '-q', '--tb=short', f'--junitxml={report}'], cwd=root,
        env={**os.environ, 'PYTHONPATH':tmp + os.pathsep + str(root)}, capture_output=True, timeout=60)
    cases = ET.parse(report).findall('.//testcase') if report.exists() else []
    if result.returncode != 1 or len(cases) != 1 or cases[0].find('failure') is None or 'AssertionError' not in (cases[0].find('failure').text or ''):
        raise SystemExit('FAIL: missing security scheme not detected')
    print('PASS: missing webhook security scheme detected')
