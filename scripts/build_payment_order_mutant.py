"""Restore AUD037 only in an isolated temporary client build."""
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="reprep-payment-order-mutant-") as tmp:
    dest = Path(tmp)
    shutil.copytree(root / "apps/client", dest / "apps/client")
    for name in ("package.json", "vite.config.ts"):
        shutil.copy(root / name, dest / name)
    (dest / "node_modules").symlink_to(root / "node_modules", target_is_directory=True)
    path = dest / "apps/client/src/Collection.tsx"
    source = path.read_text()
    for value in ('l.status || "scheduled"', 'l.payment_status'):
        before = 'disabled={busy}\n                        value={' + value + '}'
        assert source.count(before) == 1, "AUD037 mutation target must be unique"
        source = source.replace(before, 'disabled={false}\n                        value={' + value + '}', 1)
    path.write_text(source)
    subprocess.run([str(root / "node_modules/.bin/vite"), "build"], cwd=dest,
                   check=True, capture_output=True, timeout=60)
    bundles = list((dest / "dist/assets").glob("*.js"))
    assert len(bundles) == 1
    output = root / "artifacts/deep-audit/payment-order-mutant.js"
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(bundles[0], output)
    print("Built isolated AUD037 mutant: lesson status and payment controls unlocked")
