"""SQLite online backup/restore to a NEW file only; never overwrite live data."""
import argparse
import os
from pathlib import Path
import sqlite3
from urllib.parse import quote
from .config import Settings


def verify(path):
    with sqlite3.connect('file:'+quote(str(Path(path).resolve()))+'?mode=ro',uri=True) as db:
        if db.execute('PRAGMA integrity_check').fetchone()[0]!='ok':
            raise ValueError('Backup integrity check failed')
        if not db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='submissions'").fetchone():
            raise ValueError('Not a reprep database')


def snapshot(source,target):
    source,target=Path(source).resolve(),Path(target).resolve()
    verify(source)
    target.parent.mkdir(parents=True,exist_ok=True)
    fd=os.open(target,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600);os.close(fd)
    try:
        with sqlite3.connect('file:'+quote(str(source))+'?mode=ro',uri=True) as src, sqlite3.connect(target) as dst:
            src.backup(dst)
        verify(target)
    except Exception:
        target.unlink()  # Only the new file created by this call, never source/existing data.
        raise


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('operation',choices=['backup','restore','verify'])
    parser.add_argument('--source')
    parser.add_argument('--output')
    args=parser.parse_args()
    source=args.source or Settings.load().database
    if args.operation=='verify': verify(source)
    else:
        if not args.output: parser.error('--output is required; existing files are never overwritten')
        snapshot(source,args.output)
    print('PASS: database integrity checked; no rows or credentials printed.')


if __name__=='__main__': main()
