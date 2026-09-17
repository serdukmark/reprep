# Architecture and integrations

## 1. Architecture goals

- deliver the P0 flow quickly;
- preserve clear domain boundaries;
- keep external providers replaceable;
- support safe handling of learner data;
- remain reproducible for hackathon review;
- allow a real pilot without manual database editing;
- fail safely when AI or MAX services are unavailable.

## 2. Proposed logical components

### MAX client surface `[PROPOSED]`

A MAX Mini App is the preferred product surface because the workflow requires multiple screens and structured interactions.

An optional MAX bot may provide reminders or deep links.

- `[OPEN][EXTERNAL CONFIRMATION REQUIRED]` exact required hackathon surface;
- `[OPEN]` MAX authentication, webview, notification and deep-link capabilities;
- `[OPEN]` platform review or deployment process.

### Application client

Responsibilities:

- tutor and learner workflows;
- local form state and safe autosave behavior;
- render learner-safe and tutor-specific data;
- clear AI and review status;
- mobile accessibility;
- no embedded secrets or privileged authorization logic.

### Application backend

Responsibilities:

- identity verification and authorization;
- domain workflow;
- assignment/submission lifecycle;
- data persistence;
- AI orchestration;
- progress computation;
- integrations and notifications;
- audit and operational endpoints.

### Relational database `[PROPOSED]`

Recommended for structured relationships, lifecycle integrity and authorization queries.

- `[OPEN]` provider and engine;
- `[OPEN]` migration/ORM tooling.

### Object storage `[P1][OPEN]`

Needed only if file uploads are included.

Must support access control, size/type restrictions, deletion and safe download URLs.

### Background jobs `[PROPOSED]`

Useful for AI analysis, reminders and non-blocking processing.

- `[OPEN]` queue mechanism;
- a simple database-backed job model may be sufficient for the pilot if reliable and documented.

### AI adapter

Provider-neutral interface for:

- analyze submission;
- generate hint or explanation;
- optional assignment-bound Q&A;
- optional retrieval from approved materials.

### Analytics adapter `[P1]`

Must accept sanitized events only.

## 3. Suggested bounded modules

- identity/access;
- tutor-learner relationships;
- assignments;
- submissions;
- AI assessment;
- skills/progress;
- schedule/reminders;
- materials;
- manual payment status;
- feedback/pilot operations.

Physical services may remain a modular monolith for speed. Do not create microservices solely for appearance.

## 4. Deployment environments

Suggested:

- local development;
- shared staging/demo;
- production/pilot.

`[OPEN]` Whether staging and production must be separate during the hackathon.

At minimum:

- environment-specific configuration;
- no production secrets in local files committed to git;
- database migrations applied predictably;
- health/readiness checks;
- rollback or rapid redeploy procedure;
- synthetic demo reset separated from real pilot data.

## 5. Technology choices still open

- frontend framework and language;
- backend framework and language;
- database and hosting providers;
- queue implementation;
- AI provider/model;
- storage provider;
- analytics solution;
- error monitoring;
- test frameworks;
- CI/CD provider;
- infrastructure-as-code approach.

Agents must not infer these from examples in documentation.

## 6. Integration adapters

Define internal interfaces before provider-specific code.

### IdentityProvider

Possible responsibilities:

- validate external launch/session data;
- map external identity to internal user;
- expose verified attributes only.

### NotificationProvider

- send approved reminder;
- return delivery status;
- enforce opt-out and rate limits.

### AIProvider

- execute structured generation;
- report model/version and usage metadata;
- support timeout and cancellation;
- avoid domain-specific decisions inside the adapter.

### FileStorage

- create authorized upload/download operations;
- delete object;
- inspect metadata;
- never expose a global public bucket by default.

### AnalyticsSink

- accept allowlisted sanitized events;
- remain no-op in local or privacy-restricted environments.

## 7. Resilience requirements

- preserve submissions before AI calls;
- use timeouts for external dependencies;
- bounded retries with idempotency;
- circuit-break or disable unstable optional capability;
- distinguish user errors, transient dependency errors and internal failures;
- maintain a manual tutor path when AI is unavailable;
- demo must have a pre-validated fixture and backup video.

## 8. Reproducibility

Repository should eventually provide:

- current README;
- `.env.example` without secrets;
- dependency lockfiles;
- database migration instructions;
- seed/demo instructions;
- build/start/test commands;
- Docker support if required or useful;
- clean-environment verification report.

Exact commands cannot be specified until the stack is selected.
