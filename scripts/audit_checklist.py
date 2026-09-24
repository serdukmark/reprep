"""Resolve evidence references for every checked requirement; does not execute UI tests.
Existence of a test is not proof of a pass or completeness: manual scope audit is
recorded separately in docs/37_CHECKLIST_AND_FAILURE_AUDIT_RU.md.
"""
import json
from pathlib import Path
import re

ROOT=Path(__file__).resolve().parents[1]


def audit():
    files=[p for root in ('tests','scripts','docs/evidence') for p in (ROOT/root).rglob('*') if p.is_file() and '__pycache__' not in p.parts]
    files += [ROOT/p for p in ('README.md','package-lock.json','requirements.txt','Dockerfile')]
    rows={}
    for line in (ROOT/'docs/30_TEAM_CHECKLIST_RU.md').read_text().splitlines():
        fields=[v.strip() for v in line.split('|')]
        if len(fields)>=6 and re.match(r'^(TEAM-|FR-|CASE-|VOICE-|AI-USE-)',fields[1]):
            if fields[1] in rows:raise ValueError('Duplicate requirement ID: '+fields[1])
            rows[fields[1]]={'requirement':fields[2],'status':fields[3],'note':fields[4]}
    def resolve(key,seen=None):
        seen=set() if seen is None else seen
        if key in seen:return []
        seen.add(key);note=rows[key]['note'];matches=[]
        for path in files:
            name=path.name
            # Historical notes sometimes omit the .spec.ts suffix.
            short=name.removesuffix('.spec.ts') if name.endswith('.spec.ts') else name
            if name in note or (name.endswith('.spec.ts') and short in note):
                matches.append(str(path.relative_to(ROOT)))
        for other in re.findall(r'\b(?:TEAM-\d+|FR-[A-Z]+-\d+|CASE-\d+)\b',note):
            if other in rows:matches += resolve(other,seen)
        return sorted(set(matches))
    items=[]
    for key,row in rows.items():
        if row['status']!='П':continue
        sources=resolve(key)
        methods=[]
        for source in sources:
            if source.startswith('tests/test_') and source.endswith('.py'):
                methods.append('.venv/bin/python -m pytest '+source+' -q')
            elif source.startswith('tests/browser/'):
                methods.append('Headless browser only, isolated loopback DB; setup in docs/43_AUDIT_MORNING_RU.md: '+source)
            elif source.startswith('docs/evidence/'):
                methods.append('Read recorded evidence and its limitations: '+source)
            else:methods.append('Inspect artifact / explicit operation (not automatically executed): '+source)
        items.append({'id':key,'requirement':row['requirement'],'sources':sources,'verification_methods':methods})
    result={'checked_rows':len(items),'missing_evidence':[x['id'] for x in items if not x['sources']],
            'scope':'reference audit only; no implied fresh test passes or live MAX','items':items}
    (ROOT/'docs/evidence/checklist-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({k:result[k] for k in ('checked_rows','missing_evidence')},ensure_ascii=False))
    return not result['missing_evidence']


if __name__=='__main__':raise SystemExit(0 if audit() else 1)
