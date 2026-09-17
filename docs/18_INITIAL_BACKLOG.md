# Initial implementation backlog

This backlog is stack-neutral. Tasks may be split after technology decisions, but requirement IDs and acceptance outcomes should remain traceable.

## Epic E0 — repository and environments

### E0-1 — repository scaffold

- Select and record stack decisions.
- Define monorepo/separate-repo structure.
- Add lint, formatting, tests and build commands.
- Add `.env.example` without secrets.
- Add CI skeleton.
- Requirement links: engineering baseline.

Acceptance:

- new contributor follows README and runs current services;
- CI runs without provider secrets where possible.

### E0-2 — shared staging

- Deploy minimal client/backend/database.
- Add health/readiness checks.
- Document configuration and rollback/redeploy.

Acceptance:

- team can open shared build;
- no manual database changes required after documented deploy.

## Epic E1 — identity and relationships

### E1-1 — demo identity

- Implement synthetic tutor and learner access for development/demo.
- Do not make demo bypass available in production without explicit guard.
- Requirements: FR-AUTH-001, FR-DEMO-001.

### E1-2 — role authorization

- Implement role and relationship authorization server-side.
- Add cross-tutor and cross-learner isolation tests.
- Requirements: FR-AUTH-002, FR-AUTH-003.

### E1-3 — invitations

- Implement proposed invite lifecycle behind provider-neutral delivery.
- Requirements: FR-AUTH-004.
- Blocked by: OQ-MAX-004 for final MAX delivery.

## Epic E2 — assignments

### E2-1 — draft builder domain

- Assignment/task schema, validation and draft lifecycle.
- Requirements: FR-ASG-001 through FR-ASG-004.
- Blocked by: OQ-PROD-001 and OQ-PROD-004 for exact task types.

### E2-2 — tutor assignment UI

- Draft editor, rubric separation, preview and validation.
- Requirements: FR-ASG-001, FR-ASG-003, FR-ASG-005.

### E2-3 — publish and assign

- Publish/version/assign lifecycle and due date.
- Requirements: FR-ASG-006, FR-ASG-007.

## Epic E3 — learner submission

### E3-1 — learner work list and task view

- Active/completed work and safe assignment payload.
- Requirements: FR-SUB-001.

### E3-2 — save and final submit

- Reliable save, intentional submit and immutable original.
- Requirements: FR-SUB-002 through FR-SUB-004.

### E3-3 — submission failure handling

- Retry/idempotency/network interruption.
- Requirements: FR-SUB-002, FR-SUB-003.

## Epic E4 — AI assessment

### E4-1 — provider-neutral AI interface

- Internal request/response types.
- Adapter placeholder or mock.
- Blocked by provider selection only for live adapter.
- Requirements: FR-AI-001, FR-AI-002.

### E4-2 — schema validation and lifecycle

- Structured response, status model, persistence and invalid-output handling.
- Requirements: FR-AI-002, FR-AI-003, FR-AI-008.

### E4-3 — feedback and hints

- Explanation and hint policy.
- Requirements: FR-AI-004, FR-AI-005.

### E4-4 — tutor review

- Confirm, edit, reject and audit.
- Requirements: FR-AI-006, FR-PROG-002.

### E4-5 — evaluation harness

- Versioned synthetic fixtures, report generation and regression gate.
- Requirements: AI system specification.
- Blocked by first subject/ground truth.

## Epic E5 — progress

### E5-1 — evidence ledger

- Store evidence tied to tasks and review states.
- Requirements: FR-PROG-001, FR-PROG-002.

### E5-2 — tutor progress view

- Evidence-backed skill summary and assignment history.
- Requirements: FR-PROG-003.

### E5-3 — learner progress view

- Safe understandable progress.
- Requirements: FR-PROG-004.

## Epic E6 — pilot capabilities

### E6-1 — onboarding

- Tutor flow to first learner and assignment.

### E6-2 — schedule/reminders `[P1]`

- Requirements: FR-SCHED-001, FR-SCHED-002.
- Blocked by MAX notification capabilities.

### E6-3 — materials `[P1]`

- Start with authorized links; files only after security decisions.
- Requirements: FR-MAT-001 through FR-MAT-003.

### E6-4 — payment status `[P1]`

- Manual status only.
- Requirements: FR-PAY-001.

### E6-5 — contextual feedback `[P1]`

- Usefulness rating and issue report.
- Requirements: FR-FB-001.

## Epic E7 — safety and operations

### E7-1 — sanitized logging and error references

- Requirements: FR-OPS-001.

### E7-2 — demo reset

- Deterministic synthetic fixture reset.
- Requirements: FR-DEMO-001.

### E7-3 — security tests

- Cross-tenant access, answer-key leakage, secrets and logs.

### E7-4 — pilot cleanup/deletion

- Implement procedure once retention decisions are known.

## Epic E8 — evidence and submission

### E8-1 — research synthesis

- Anonymized interview findings and baseline.

### E8-2 — pilot report

- Actual flow, measurements, failures, quote permission and limitations.

### E8-3 — submission package

- README, architecture, presentation, appendix, demo video, access checks.

## Critical sequence

1. E0 repository/staging.
2. E1 identity/authorization.
3. E2 assignment.
4. E3 submission.
5. E4 AI and tutor review.
6. E5 progress.
7. E7 security/reliability.
8. E6 pilot enhancements only after P0 works.
9. E8 evidence/submission continuously, not only on the final day.
