import json
import sqlite3
from pathlib import Path
from contextlib import contextmanager

SCHEMA = '''
CREATE TABLE IF NOT EXISTS max_outbox(id TEXT PRIMARY KEY, recipient INTEGER NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, available_at REAL NOT NULL DEFAULT 0, created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY);
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, external_id TEXT UNIQUE, role TEXT NOT NULL CHECK(role IN ('tutor','learner','guardian')), alias TEXT NOT NULL, demo INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires REAL NOT NULL);
CREATE TABLE IF NOT EXISTS relationships(id TEXT PRIMARY KEY, tutor_id TEXT NOT NULL REFERENCES users(id), learner_id TEXT NOT NULL REFERENCES users(id), subject TEXT NOT NULL, UNIQUE(tutor_id,learner_id,subject));
CREATE TABLE IF NOT EXISTS invitations(id TEXT PRIMARY KEY, tutor_id TEXT NOT NULL REFERENCES users(id), token_hash TEXT UNIQUE NOT NULL, subject TEXT NOT NULL, expires REAL NOT NULL, state TEXT NOT NULL DEFAULT 'created', accepted_by TEXT REFERENCES users(id));
CREATE TABLE IF NOT EXISTS assignments(id TEXT PRIMARY KEY, tutor_id TEXT NOT NULL REFERENCES users(id), relationship_id TEXT NOT NULL REFERENCES relationships(id), status TEXT NOT NULL DEFAULT 'draft', revision INTEGER NOT NULL DEFAULT 1, data TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS drafts(assignment_id TEXT NOT NULL REFERENCES assignments(id), learner_id TEXT NOT NULL REFERENCES users(id), revision INTEGER NOT NULL DEFAULT 0, answers TEXT NOT NULL, PRIMARY KEY(assignment_id,learner_id));
CREATE TABLE IF NOT EXISTS submissions(id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id), learner_id TEXT NOT NULL REFERENCES users(id), attempt INTEGER NOT NULL, answers TEXT NOT NULL, checksum TEXT NOT NULL, submitted TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', analysis TEXT, lease_until REAL NOT NULL DEFAULT 0, retries INTEGER NOT NULL DEFAULT 0, UNIQUE(assignment_id,learner_id,attempt));
CREATE TABLE IF NOT EXISTS draft_files(assignment_id TEXT PRIMARY KEY REFERENCES assignments(id) ON DELETE CASCADE,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS submission_files(submission_id TEXT PRIMARY KEY REFERENCES submissions(id) ON DELETE CASCADE,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY, submission_id TEXT NOT NULL REFERENCES submissions(id), tutor_id TEXT NOT NULL REFERENCES users(id), action TEXT NOT NULL, data TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS evidence(id TEXT PRIMARY KEY, relationship_id TEXT NOT NULL REFERENCES relationships(id), task_id TEXT NOT NULL, skill TEXT NOT NULL, correctness TEXT NOT NULL, review_id TEXT NOT NULL REFERENCES reviews(id), submission_id TEXT NOT NULL REFERENCES submissions(id), created TEXT NOT NULL, UNIQUE(review_id,task_id));
CREATE TABLE IF NOT EXISTS lessons(id TEXT PRIMARY KEY, relationship_id TEXT NOT NULL REFERENCES relationships(id), data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS materials(id TEXT PRIMARY KEY, relationship_id TEXT NOT NULL REFERENCES relationships(id), data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS skill_graphs(relationship_id TEXT PRIMARY KEY REFERENCES relationships(id) ON DELETE CASCADE,revision INTEGER NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS learning_plans(relationship_id TEXT PRIMARY KEY REFERENCES relationships(id), revision INTEGER NOT NULL, data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tutor_offers(tutor_id TEXT PRIMARY KEY REFERENCES users(id),revision INTEGER NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS tutor_requests(id TEXT PRIMARY KEY,learner_id TEXT NOT NULL REFERENCES users(id),tutor_id TEXT NOT NULL REFERENCES users(id),client_id TEXT NOT NULL,subject TEXT NOT NULL,message TEXT NOT NULL,offer_revision INTEGER NOT NULL,price_rub INTEGER NOT NULL,duration INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'pending',reply TEXT NOT NULL DEFAULT '',relationship_id TEXT,created TEXT NOT NULL,UNIQUE(learner_id,client_id));
CREATE TABLE IF NOT EXISTS workspaces(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS workspace_members(workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,user_id TEXT NOT NULL REFERENCES users(id),active INTEGER NOT NULL DEFAULT 1,PRIMARY KEY(workspace_id,user_id));
CREATE TABLE IF NOT EXISTS workspace_invites(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,expires REAL NOT NULL,state TEXT NOT NULL DEFAULT 'created',accepted_by TEXT REFERENCES users(id));
CREATE TABLE IF NOT EXISTS workspace_templates(id TEXT PRIMARY KEY,workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,author_id TEXT NOT NULL REFERENCES users(id),source_id TEXT NOT NULL,source_revision INTEGER NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(workspace_id,source_id,source_revision));
CREATE TABLE IF NOT EXISTS workspace_copies(user_id TEXT NOT NULL REFERENCES users(id),client_id TEXT NOT NULL,template_id TEXT NOT NULL REFERENCES workspace_templates(id),relationship_id TEXT NOT NULL,assignment_id TEXT NOT NULL,PRIMARY KEY(user_id,client_id));
CREATE TABLE IF NOT EXISTS guardian_access(id TEXT PRIMARY KEY,relationship_id TEXT NOT NULL REFERENCES relationships(id) ON DELETE CASCADE,tutor_id TEXT NOT NULL REFERENCES users(id),token_hash TEXT UNIQUE NOT NULL,expires REAL NOT NULL,state TEXT NOT NULL DEFAULT 'created',guardian_id TEXT REFERENCES users(id),created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS generations(id TEXT PRIMARY KEY,material_id TEXT NOT NULL REFERENCES materials(id),tutor_id TEXT NOT NULL REFERENCES users(id),client_id TEXT NOT NULL,count INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'queued',assignment_id TEXT,lease_until REAL NOT NULL DEFAULT 0,created TEXT NOT NULL,UNIQUE(tutor_id,client_id));
CREATE TABLE IF NOT EXISTS learning_groups(id TEXT PRIMARY KEY,tutor_id TEXT NOT NULL REFERENCES users(id),revision INTEGER NOT NULL,data TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS group_actions(group_id TEXT NOT NULL REFERENCES learning_groups(id),client_id TEXT NOT NULL,request TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(group_id,client_id));
CREATE TABLE IF NOT EXISTS ai_questions(id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id), learner_id TEXT NOT NULL REFERENCES users(id), client_id TEXT NOT NULL, task_id TEXT NOT NULL, question TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued', draft TEXT, response TEXT, lease_until REAL NOT NULL DEFAULT 0, created TEXT NOT NULL, UNIQUE(learner_id,client_id));
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, assignment_id TEXT NOT NULL REFERENCES assignments(id), user_id TEXT NOT NULL REFERENCES users(id), client_id TEXT NOT NULL, text TEXT NOT NULL, created TEXT NOT NULL, UNIQUE(user_id,client_id));
CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), context_id TEXT NOT NULL, category TEXT NOT NULL, text TEXT NOT NULL, created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY, actor_id TEXT, event TEXT NOT NULL, resource_id TEXT, created TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS assignments_tutor ON assignments(tutor_id);
CREATE INDEX IF NOT EXISTS submissions_status ON submissions(status,lease_until);
CREATE INDEX IF NOT EXISTS relationships_learner ON relationships(learner_id);
INSERT OR IGNORE INTO schema_migrations VALUES(1);
INSERT OR IGNORE INTO schema_migrations VALUES(2);
INSERT OR IGNORE INTO schema_migrations VALUES(3);
INSERT OR IGNORE INTO schema_migrations VALUES(4);
INSERT OR IGNORE INTO schema_migrations VALUES(6);
INSERT OR IGNORE INTO schema_migrations VALUES(7);
INSERT OR IGNORE INTO schema_migrations VALUES(8);
'''


def initialize(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with sqlite3.connect(path) as conn:
        conn.executescript(SCHEMA)
        conn.execute('PRAGMA journal_mode=WAL')
        if not conn.execute('SELECT 1 FROM schema_migrations WHERE version=5').fetchone():
            # SQLite documented create/copy/drop/rename migration, not writable_schema.
            conn.execute('PRAGMA foreign_keys=OFF')
            conn.execute('BEGIN IMMEDIATE')
            objects=conn.execute("SELECT sql FROM sqlite_schema WHERE tbl_name='users' AND type IN ('index','trigger') AND sql IS NOT NULL").fetchall()
            definition=next(part.strip() for part in SCHEMA.split(';') if part.strip().startswith('CREATE TABLE IF NOT EXISTS users('))
            conn.execute(definition.replace('CREATE TABLE IF NOT EXISTS users(', 'CREATE TABLE users_v5('))
            conn.execute('INSERT INTO users_v5 SELECT * FROM users')
            conn.execute('DROP TABLE users')
            conn.execute('ALTER TABLE users_v5 RENAME TO users')
            for (sql,) in objects:conn.execute(sql)
            if conn.execute('PRAGMA foreign_key_check').fetchone():raise RuntimeError('Migration failed foreign key validation')
            conn.execute('INSERT INTO schema_migrations VALUES(5)')
            conn.commit()


@contextmanager
def connect(path):
    conn = sqlite3.connect(path, timeout=10, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute('PRAGMA foreign_keys=ON')
    conn.execute('BEGIN IMMEDIATE')
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def dumps(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':'))


def one(conn, sql, args=()):
    row = conn.execute(sql, args).fetchone()
    return dict(row) if row else None


def rows(conn, sql, args=()):
    return [dict(r) for r in conn.execute(sql, args).fetchall()]
