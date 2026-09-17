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
