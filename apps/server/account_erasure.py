"""Operator-only erasure of a requested account; dry run by default, backup required."""
import argparse
import json
import os
from .db import connect,one,rows,dumps
from .config import Settings
from .backup import snapshot


def plan(c,user_id):
    user=one(c,'SELECT id,external_id FROM users WHERE id=?',(user_id,))
    request=one(c,"SELECT id FROM deletion_requests WHERE user_id=? AND status='requested'",(user_id,))
    if not user or not request:raise ValueError('An active user deletion request is required')
    links=rows(c,'SELECT id FROM relationships WHERE tutor_id=? OR learner_id=?',(user_id,user_id))
    work=one(c,'SELECT count(*) n FROM assignments WHERE relationship_id IN (SELECT id FROM relationships WHERE tutor_id=? OR learner_id=?)',(user_id,user_id))['n']
    return {'relationships':len(links),'assignments':work,'backup_retention':'Must be handled separately by the approved policy'}


def erase_requested(c,user_id):
    summary=plan(c,user_id)
    user=one(c,'SELECT external_id FROM users WHERE id=?',(user_id,))
    rscope='SELECT id FROM relationships WHERE tutor_id=? OR learner_id=?';args=(user_id,user_id)
    rels={r['id'] for r in rows(c,rscope,args)}
    ascope=f'SELECT id FROM assignments WHERE relationship_id IN ({rscope})'
    sscope=f'SELECT id FROM submissions WHERE assignment_id IN ({ascope})'
    tscope='SELECT id FROM workspace_templates WHERE author_id=? OR workspace_id IN (SELECT id FROM workspaces WHERE owner_id=?)'
    c.execute(f'DELETE FROM workspace_copies WHERE user_id=? OR template_id IN ({tscope}) OR assignment_id IN ({ascope})',(user_id,*args,*args))
    c.execute('DELETE FROM workspaces WHERE owner_id=?',(user_id,))
    c.execute('DELETE FROM workspace_templates WHERE author_id=?',(user_id,))
    c.execute('DELETE FROM workspace_members WHERE user_id=?',(user_id,))
    c.execute('DELETE FROM workspace_invites WHERE accepted_by=?',(user_id,))
    c.execute('DELETE FROM guardian_access WHERE tutor_id=? OR guardian_id=?',args)
    c.execute('DELETE FROM tutor_requests WHERE tutor_id=? OR learner_id=?',args)
    c.execute('DELETE FROM tutor_offers WHERE tutor_id=?',(user_id,))
    c.execute('DELETE FROM group_actions WHERE group_id IN (SELECT id FROM learning_groups WHERE tutor_id=?)',(user_id,))
    c.execute('DELETE FROM learning_groups WHERE tutor_id=?',(user_id,))
    for group in rows(c,'SELECT id,data FROM learning_groups'):
        data=json.loads(group['data']);remaining=[rid for rid in data['relationship_ids'] if rid not in rels]
        if remaining!=data['relationship_ids']:
            data['relationship_ids']=remaining
            c.execute('UPDATE learning_groups SET data=?,revision=revision+1 WHERE id=?',(dumps(data),group['id']))
            c.execute('DELETE FROM group_actions WHERE group_id=?',(group['id'],))
    c.execute(f'DELETE FROM generations WHERE tutor_id=? OR material_id IN (SELECT id FROM materials WHERE relationship_id IN ({rscope}))',(user_id,*args))
    c.execute(f'DELETE FROM reports WHERE user_id=? OR context_id IN ({ascope})',(user_id,*args))
    c.execute(f'DELETE FROM evidence WHERE submission_id IN ({sscope})',args)
    c.execute(f'DELETE FROM reviews WHERE submission_id IN ({sscope})',args)
    c.execute(f'DELETE FROM submissions WHERE assignment_id IN ({ascope})',args)
    c.execute(f'DELETE FROM drafts WHERE assignment_id IN ({ascope})',args)
    c.execute(f'DELETE FROM ai_questions WHERE assignment_id IN ({ascope})',args)
    c.execute(f'DELETE FROM messages WHERE user_id=? OR assignment_id IN ({ascope})',(user_id,*args))
    c.execute(f'DELETE FROM assignments WHERE id IN ({ascope})',args)
    for table in ('lessons','materials','learning_plans'):
        c.execute(f'DELETE FROM {table} WHERE relationship_id IN ({rscope})',args)
    c.execute(f'DELETE FROM relationships WHERE id IN ({rscope})',args)
    c.execute('DELETE FROM invitations WHERE tutor_id=? OR accepted_by=?',args)
    c.execute('DELETE FROM sessions WHERE user_id=?',(user_id,))
    c.execute('DELETE FROM audit WHERE actor_id=?',(user_id,))
    if user['external_id']:c.execute('DELETE FROM max_outbox WHERE recipient=?',(user['external_id'],))
    c.execute('DELETE FROM users WHERE id=?',(user_id,))
    if c.execute('PRAGMA foreign_key_check').fetchone():raise ValueError('Erasure would violate database integrity')
    return summary


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--user-id',required=True)
    parser.add_argument('--apply',action='store_true')
    parser.add_argument('--confirm-user-id')
    parser.add_argument('--backup')
    args=parser.parse_args();cfg=Settings.load()
    with connect(cfg.database) as c:summary=plan(c,args.user_id)
    if not args.apply:
        print(json.dumps({'dry_run':True,**summary}));return
    if os.getenv('ACCOUNT_DELETION_APPROVED','false').lower()!='true' or args.confirm_user_id!=args.user_id or not args.backup:
        parser.error('Apply requires approved policy, exact --confirm-user-id and a NEW --backup path')
    snapshot(cfg.database,args.backup)
    with connect(cfg.database) as c:erase_requested(c,args.user_id)
    print('Account removed from live database. Backup retention remains a separate operator obligation.')


if __name__=='__main__':main()
