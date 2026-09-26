"""Reproduce AUD038's misleading 401 copy in an isolated UI build."""
from pathlib import Path
import shutil
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="reprep-export-expiry-mutant-") as tmp:
    dest = Path(tmp)
    shutil.copytree(root / "apps/client", dest / "apps/client")
    for name in ("package.json", "vite.config.ts"):
        shutil.copy(root / name, dest / name)
    (dest / "node_modules").symlink_to(root / "node_modules", target_is_directory=True)
    path = dest / "apps/client/src/api.ts"
    source = path.read_text()
    before = '"Сессия завершилась. Войдите снова и повторите экспорт."'
    assert source.count(before) == 1, "AUD038 mutation target must be unique"
    path.write_text(source.replace(before,
        '"Не удалось скачать данные. Проверьте соединение и повторите попытку."', 1))
    subprocess.run([str(root / "node_modules/.bin/vite"), "build"], cwd=dest,
                   check=True, capture_output=True, timeout=60)
    bundles = list((dest / "dist/assets").glob("*.js"))
    assert len(bundles) == 1
    output = root / "artifacts/deep-audit/export-expiry-mutant.js"
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy(bundles[0], output)
    print("Built isolated AUD038 mutant: expired session misreported as connection failure")
