"""Render the maintained audit evidence map as a readable Russian checklist."""
import json
from collections import Counter
from pathlib import Path

root = Path(__file__).resolve().parents[1]
rows = json.loads((root / 'docs/evidence/deep-audit/scenarios.json').read_text())
counts = Counter(value for row in rows for value in row['variants'].values())
lines = [
    '# Подробная матрица пользовательского аудита',
    '',
    'Снимок из `docs/evidence/deep-audit/scenarios.json`. Обновить: `python3 scripts/render_audit_matrix.py`.',
    'Основной путь и его варианты учитываются отдельно: успешный основной путь не означает полного покрытия.',
    '',
    ', '.join(f'{status}: {count}' for status, count in sorted(counts.items())) + '.',
    '',
    'Только локальная синтетика; реальный MAX и полный авторизованный боевой прогон не подтверждены.',
]
for row in rows:
    assert row['status'] in {'прошёл', 'упал', 'не проверялся'}
    lines += ['', f"## {row['id']} · {row['role']}", '', row['scenario'], '',
              f"Основной путь: **{row['status']}**. {row['evidence']}", '']
    for status in ('прошёл', 'упал', 'не проверялся', 'не применимо'):
        variants = [key for key, value in row['variants'].items() if value == status]
        if variants:
            lines.append(f"- {status.capitalize()}: {', '.join(variants)}.")
    notes = row.get('variant_notes', {})
    if notes:
        lines += ['', '<details>', '<summary>Уточнения и доказательства вариантов</summary>', '']
        for variant, note in notes.items():
            lines.append(f'- **{variant}**: {note}')
        lines += ['', '</details>']
(root / 'docs/45_AUDIT_MATRIX_RU.md').write_text('\n'.join(lines) + '\n')
print(f'Rendered {len(rows)} scenarios; variant statuses: {dict(counts)}')
