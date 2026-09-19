# Testing and acceptance

## 1. Quality strategy

Testing must protect the P0 flow first. High test counts are not a substitute for meaningful coverage.

## 2. Test layers

### Unit tests

Priority targets:

- authorization decisions;
- assignment state transitions;
- submission finalization and idempotency;
- schema validation;
- progress/evidence calculations;
- permission-safe serializers;
- retry/backoff rules;
- deadline/timezone behavior.

### Integration tests

Priority targets:

- database constraints and migrations;
- tutor/learner isolation;
- assignment to submission flow;
- AI adapter with recorded synthetic fixtures;
- tutor review to progress update;
- file or notification adapter when implemented;
- demo data reset.

### End-to-end tests

Required happy path:

1. tutor enters;
2. tutor accesses learner;
3. tutor creates/publishes/assigns work;
4. learner enters and submits;
5. AI analysis completes or fixture simulates the approved response;
6. tutor reviews and confirms/corrects;
7. progress updates;
8. both roles see correct safe data.

Required failure paths:

- AI timeout;
- invalid AI output;
- learner loses network during work;
- repeated final-submit request;
- unauthorized resource ID;
- expired or invalid invitation;
- empty/invalid task data;
- missing answer key/rubric;
- demo reset after partial use.

### AI evaluation tests

Maintain a versioned synthetic or lawfully obtained evaluation set. See `06_AI_SYSTEM_SPEC.md`.

### Manual exploratory testing

Required on:

- supported mobile environment;
- MAX webview or equivalent approved test surface;
- at least one second device/browser where possible;
- poor network conditions;
- new account and existing account;
- long text and boundary values;
- non-Latin and mathematical content relevant to the selected subject.

## 3. Acceptance criteria by release gate

### Gate A — skeleton

- client and backend run;
- shared environment reachable;
- demo identity works;
- roles are represented;
- no real personal data in fixtures.

### Gate B — assignment flow

- tutor creates and assigns;
- learner receives and submits;
- original response persists;
- unauthorized access tests pass.

### Gate C — AI flow

- structured response validates;
- failure states work;
- tutor can correct/reject;
- no answer-key leakage;
- evaluation report generated for current prompt/model version.

### Gate D — pilot-ready

- real adult tutor can onboard with assistance;
- demo and pilot data are separated;
- logs and monitoring are usable;
- consent/data approach documented;
- deletion or cleanup procedure exists;
- critical path works on target device.

### Gate E — submission-ready

- feature freeze active;
- clean-environment start verified;
- README current;
- secrets scan/review complete;
- all public links checked;
- backup video available;
- presentation claims trace to evidence;
- critical and high-severity defects closed or explicitly accepted.

## 4. Severity definitions

### Critical

- data leakage or unauthorized access;
- loss/corruption of submission;
- secrets exposed;
- P0 flow cannot complete;
- harmful AI output with no containment;
- deployment entirely unavailable.

### High

- major P0 step unreliable;
- incorrect progress written as confirmed;
- answer key visible to learner;
- tutor cannot correct AI;
- pilot blocked without a safe workaround.

### Medium

- secondary flow failure;
- confusing but recoverable state;
- inaccurate non-critical copy;
- P1 capability unreliable.

### Low

- cosmetic issue without usability impact;
- minor polish or non-blocking inconsistency.

## 5. Release rule

Before submission:

- zero open critical defects;
- zero unaccepted high defects;
- P0 end-to-end pass;
- security acceptance checks pass;
- known medium/low issues documented.

## 6. Test data policy

- use synthetic identities;
- avoid real learner answers in automated tests;
- do not snapshot secrets or raw provider responses containing personal data;
- clearly label demonstration outcomes as synthetic versus measured pilot outcomes;
- make fixture reset deterministic.

## 7. AI quality report template

For every significant model/prompt version, record:

- date and version;
- provider/model identifier where allowed;
- evaluation-set version;
- cases passed/failed;
- tutor agreement/edit/reject rates if available;
- schema failures;
- unsafe outputs;
- latency and cost summary;
- known limitations;
- release decision.

## 8. Clean-environment verification

Run on another machine or clean container/environment:

1. clone repository;
2. follow README exactly;
3. configure only documented variables;
4. apply migrations;
5. seed synthetic demo;
6. run tests;
7. start services;
8. complete P0 scenario;
9. record discrepancies;
10. fix README or code before release.

## Local implementation evidence — 20 September 2026

This is local verification, not a completed shared-environment release gate. Detailed commands/results: `22_MORNING_REPORT_RU.md`.

| Requirement | Implemented / verification | Remaining limit |
|---|---|---|
| FR-AUTH-001–004 | Demo sessions, MAX HMAC, server role/relationship checks, expiring single-use invitations; pytest | Real MAX/webview test pending |
| FR-PROFILE-001–003 | Minimal alias/role/subject relationship | One role; no account management UI |
| FR-ASG-001–007 | Draft editor, three task types, private references, skill tags, learner preview, immutable publication/copy; API and browser tests | No bulk assignment |
| FR-SUB-001–005 | Assignment list, explicit save/reload, optimistic revision, immutable submission, return/new attempt; network failure browser test | Read-only attempt archive now available |
| FR-AI-001–008 | Bounded context, schema, uncertainty, gated feedback, teacher edits/approval, provider error/manual continuation; live OpenRouter API and browser | Small synthetic eval, no expert-approved accuracy threshold |
| FR-PROG-001–004 | Evidence only after review; review source, tutor/learner view and JSON export | No calibrated skill mastery model; FR-PROG-005 recommendations not implemented |
| FR-SCHED-001 / FR-MAT-001 / FR-PAY-001 | Schedule, HTTPS material links, tutor-private manual payment; browser test | No bot reminders, uploads, automatic payments |
| FR-FB-001 | Authorized feedback report persisted | No admin triage UI |
| FR-DEMO-001 / FR-OPS-001 | Scoped reset with real-user preservation, reference IDs, no secret/raw-provider logging; API tests | No monitoring service or production incident workflow |

Known test limitations: no real tutor pilot, no real learner data, no MAX app/device test, no broad load test. Swagger OpenAPI is 3.1.0. The AI evaluation scripts make explicit paid requests; the default pytest suite uses local rules or mocks and never calls paid AI.

MAX continuation: 34 server tests pass; full isolated browser suite 5/5 (including official JS Bridge snapshot) passes with synthetic MAX token and no external AI. Frozen HMAC fixture was generated independently using Node crypto. Mutation control actually runs the signature test against disabled-signature and wrong-HMAC-constant implementations; both are detected. MAX CDN is intercepted in the browser simulation. Real messenger/client and token-backed API remain untested.

History continuation: the resubmission API test now verifies both attempts through public endpoints, authorizes each reader and excludes old AI analysis from learner responses. Browser tests cover history retrieval plus return → prefilled new attempt → save → resubmit → tutor confirmation without reload. No paid AI calls were made during this continuation.

## Resilience continuation — 20 September 2026

47 server tests passed, including OpenRouter HTTP fault injection, simultaneous learner submissions, partial/idempotent demo seeding and private unsent drafts. Thirteen intentional queue/context/original mutations were detected. Browser outage + request timeout + recovery/manual review passed separately; see `28_FAILURE_TESTS_RU.md`. These are controlled faults, not external provider incidents or a load test.
