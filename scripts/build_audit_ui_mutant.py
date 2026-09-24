"""Build deliberately broken UI in an isolated temporary copy; never edits real sources."""
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='reprep-ui-mutant-') as tmp:
    dest = Path(tmp)
    shutil.copytree(root/'apps/client', dest/'apps/client')
    for name in ('package.json', 'vite.config.ts'):
        shutil.copy(root/name, dest/name)
    (dest/'node_modules').symlink_to(root/'node_modules', target_is_directory=True)
    changes = [
        ('Catalog.tsx', 'if (sequence !== catalogLoad.current) return;', 'if (false) return;'),
        ('main.tsx', 'progressLive = false;', 'progressLive = true;'),
        ('Guardian.tsx', 'guardianLive = false;', 'guardianLive = true;'),
        ('Assignment.tsx', 's.status === "awaiting_review" &&', 'true &&'),
        ('Assignment.tsx', 'new Date(a.due_at).getTimezoneOffset()', 'new Date().getTimezoneOffset()'),
        ('Workspaces.tsx', 'workspaceLoad.current === revision', 'true'),
        ('main.tsx', 'setPage("assignments");', '/* mutation: no return to assignment list */'),
        ('main.tsx', '"Откройте приложение в мессенджере."', '"Начните с демонстрации или откройте приложение в мессенджере."'),
    ]
    for filename, before, after in changes:
        path = dest/'apps/client/src'/filename
        source = path.read_text()
        assert source.count(before) == 1, filename
        path.write_text(source.replace(before, after, 1))
    subprocess.run([str(root/'node_modules/.bin/vite'), 'build'], cwd=dest,
                   check=True, capture_output=True, timeout=60)
    bundles = list((dest/'dist/assets').glob('*.js'))
    assert len(bundles) == 1
    output = root/'artifacts/deep-audit/selection-retry-mutant.js'
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(bundles[0], output)
    print('Built isolated UI mutant: stale-selection/retry guards disabled and wrong demo copy restored')
