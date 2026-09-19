"""Run the actual auth contract tests against two intentionally broken in-memory modules."""
import importlib.util
from pathlib import Path
import subprocess
import sys
import tempfile

def main():
    root=Path(__file__).resolve().parents[1]
    source=(root/'apps/server/auth.py').read_text()
    mutants={
        'signature_disabled':source.replace('if not hmac.compare_digest(expected, supplied):','if False:'),
        'wrong_hmac_constant':source.replace("b'WebAppData'","b'BrokenData'"),
    }
    with tempfile.TemporaryDirectory() as d:
        for name,changed in mutants.items():
            path=Path(d)/(name+'.py');path.write_text(changed)
            plugin=Path(d)/'mutant_plugin.py'
            plugin.write_text(
                "import importlib.util\ndef pytest_collection_modifyitems(items):\n"
                f" s=importlib.util.spec_from_file_location('broken_auth',{str(path)!r})\n"
                " m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\n"
                " for item in items:\n  if item.module.__name__.endswith('test_max'): item.module.verify_max=m.verify_max\n")
            import os
            env={**os.environ,'PYTHONPATH':d+os.pathsep+str(root)}
            run=subprocess.run([sys.executable,'-m','pytest','tests/test_max.py::test_frozen_vector_and_auth_tampering','-p','mutant_plugin','-q'],cwd=root,env=env,capture_output=True)
            if run.returncode!=1 or b'FAILED' not in run.stdout:
                raise SystemExit('FAIL: mutation test did not detect '+name)
            print('PASS: contract test failed as expected for '+name)

if __name__=='__main__':
    main()
