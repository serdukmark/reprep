# Product Requirements Document

## 1. Objective

The full [owner-approved concept](22_PROJECT_PASSPORT_RU.md) is an AI-native platform combining scheduling, homework, materials, payments, communication and progress for tutors and school learners, initially focused on OGE/EGE. It includes contextual AI support and a standalone affordable AI tutor. Monetization is tutor and learner subscriptions, with tutor-matching and payment commissions planned later.

This PRD specifies the first tutor-led release within that broader vision. It does not claim the full platform is already implemented.

Build a pilot-ready product that demonstrates and tests the following hypothesis:

> `[PROPOSED]` If assignment, submission and AI-assisted review are combined in one learner context, an independent tutor can reduce routine checking time while the learner receives faster, more understandable feedback between lessons.

The wording and numerical target must be updated after research.

## 2. Outcome by hackathon submission

### Required product outcome

- a tutor can access a working environment;
- the tutor can add or invite a learner;
- the tutor can create and assign work;
- the learner can open, complete and submit it;
- the system can produce structured AI-assisted analysis;
- the learner can receive an explanation or hint;
- the tutor can review and modify the AI result;
- a confirmed result can update a learner progress view;
- the full flow can run on a shared environment, not only locally.

### Required evidence outcome

- at least one adult tutor has tested the product;
- `[PROPOSED]` at least one real or realistically supervised assignment is processed end to end;
- pilot observations and limitations are recorded;
- any time-saving or quality claim is tied to actual measurement or explicitly labelled as a hypothesis.

### Required submission-quality outcome

- current README;
- reproducible start or accessible deployment;
- no secrets in code;
- presentation and supporting appendix;
- backup demonstration recording;
- working links and access;
- exact official artifact requirements incorporated once known.

## 3. Primary jobs to be done

### Tutor job

> When I teach several learners individually, I want to assign and review work without reconstructing context across multiple tools, so that I can spend more time on pedagogy and still understand each learner's gaps.

### Learner job

> When I am stuck or make an error between lessons, I want an explanation connected to my current task and level, so that I can correct the mistake without waiting for the next lesson or receiving an unrelated generic answer.

Both are `[PROPOSED]` until supported by research evidence.

## 4. Primary use case

1. Tutor signs in or uses a demo account.
2. Tutor selects an existing learner or creates/invites one.
3. Tutor creates an assignment using supported question types.
4. Tutor assigns a due date.
5. Learner opens the assignment and submits answers.
6. System stores the original submission.
7. AI analyzes the submission using an approved context package.
8. Learner receives feedback according to tutor-configured or default policy.
9. Tutor sees the original answer, AI analysis and uncertainty.
10. Tutor confirms or edits the analysis.
11. Confirmed results update the learner's skill history.

## 5. Success criteria

### Product reliability

- P0 flow completes without manual database or code intervention;
- data from one tutor is not visible to another unauthorized tutor;
- an AI provider failure does not destroy the learner submission;
- tutor can review original and generated content separately;
- the system provides explicit loading and failure states.

### Usability

- a new tutor can understand the core flow with minimal assistance;
- a learner can locate assigned work and submit it on a mobile screen;
- AI feedback is readable and clearly identified;
- the interface does not imply that AI output is final before tutor review when tutor review is required.

### Pilot

- `[PROPOSED]` one tutor onboards successfully;
- `[PROPOSED]` one to three learners or supervised test participants complete the flow;
- at least one tutor interview is conducted after use;
- critical failures and requested changes are documented.

Numerical targets for time saved, retention or learning improvement are `[OPEN]` until measured.

## 6. Constraints

- short hackathon delivery window;
- three-person team: Марк Сердюк (CPO), Иван Курбан (CTO), Дмитрий Ярочкин (CAIO);
- target users may include minors;
- external AI, MAX and hosting behavior may be unresolved;
- official case interpretation and exact submission requirements are incomplete;
- the first release must prefer depth of one flow over breadth of a full LMS.

## 7. Non-goals

See `03_SCOPE_AND_PRIORITIES.md`. At minimum, the current release does not aim to become a complete marketplace, payment processor, video platform or universal school LMS.

## 8. Release hypothesis

`[PROPOSED]` The pilot release should support one subject and a narrow set of assignment types with high-quality evaluation fixtures.

- `[OPEN]` first subject;
- `[OPEN]` supported answer types;
- `[OPEN]` whether handwritten-image answers are included;
- `[OPEN]` whether file uploads are required for P0 or P1.

## 9. Dependencies

- access to authoritative MAX platform documentation and credentials;
- selected AI provider and model;
- selected hosting, database and storage;
- tutor-provided or team-created lawful demo content;
- official hackathon rules and case criteria;
- privacy and consent approach for the pilot.

Each dependency is tracked in `15_OPEN_QUESTIONS.md`.
