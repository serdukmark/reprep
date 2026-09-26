"""Reproduce AUD036 in an isolated UI build without changing working sources."""
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="reprep-choice-label-mutant-") as tmp:
    dest = Path(tmp)
    shutil.copytree(root / "apps/client", dest / "apps/client")
    for name in ("package.json", "vite.config.ts"):
        shutil.copy(root / name, dest / name)
    (dest / "node_modules").symlink_to(root / "node_modules", target_is_directory=True)
    path = dest / "apps/client/src/Assignment.tsx"
    source = path.read_text()
    for before, after in (
        ('<fieldset className="options">\n                    <legend>Ваш ответ</legend>',
         '<label>Ваш ответ<div className="options">'),
        ('</fieldset>\n                ) : (', '</div></label>\n                ) : ('),
    ):
        assert source.count(before) == 1, "AUD036 mutation target must be unique"
        source = source.replace(before, after, 1)
    path.write_text(source)
    subprocess.run([str(root / "node_modules/.bin/vite"), "build"], cwd=dest,
                   check=True, capture_output=True, timeout=60)
    bundles = list((dest / "dist/assets").glob("*.js"))
    assert len(bundles) == 1
    output = root / "artifacts/deep-audit/choice-label-mutant.js"
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(bundles[0], output)
    print("Built isolated AUD036 mutant: nested option labels restored")
