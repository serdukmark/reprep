# Scope and priorities

## Priority definitions

- **P0:** the pilot and hackathon demonstration fail without this capability.
- **P1:** materially improves pilot value but may be removed without breaking the central learning loop.
- **P2:** useful expansion after P0/P1 stability.
- **Out of scope:** explicitly not planned for the current hackathon delivery.

Priority does not mean implementation approval when a feature depends on an `[OPEN]` external decision.

## P0 — core learning loop

### Access and roles

- tutor role;
- learner role;
- demo access or another low-friction pilot access mechanism;
- authorization separation between tutors and learners;
- relationship between a tutor and an invited learner.

### Learners

- tutor learner list;
- learner profile with minimum necessary attributes;
- subject or learning program association;
- learner-specific skill history.

### Assignments

- create draft assignment;
- supported question types defined by the selected pilot subject;
- answer key or evaluation rubric where applicable;
- assign to a learner;
- due date;
- learner list of assigned work;
- autosaved or safely submitted learner response;
- immutable record of the original submission after final submit.

### AI-assisted analysis

- construct bounded context;
- structured AI response;
- correctness or rubric assessment when supported;
- explanation of errors;
- hint-oriented feedback;
- skill-gap candidates;
- uncertainty and inability-to-assess state;
- deterministic behavior when provider is unavailable;
- tutor review and correction.

### Progress

- tutor sees results per assignment;
- tutor sees confirmed skill-gap history;
- learner sees understandable history or progress summary;
- only approved evidence updates durable mastery when review is required.

### Product quality

- mobile layout;
- loading, empty, validation, error and retry states;
- stable shared environment;
- synthetic demo data;
- auditability of AI and tutor actions;
- README and reproducible setup.

## P1 — pilot readiness

- tutor onboarding;
- invitation link or code;
- schedule and upcoming lessons;
- reminder notifications through an approved channel;
- material library with links and files;
- basic AI question flow bound to a specific assignment;
- tutor-defined feedback policy;
- recommendation for next learning action;
- status-only payment tracking without moving money;
- basic export of learner results;
- in-product feedback collection;
- basic product analytics;
- tutor-visible AI usage or limits if relevant.

## P2 — after core stability

- reusable assignment templates;
- assignment generation from tutor materials;
- group lessons;
- parent or guardian view;
- richer scheduling and calendar synchronization;
- multi-tutor organizations;
- advanced knowledge graph;
- cohort benchmarking;
- subscription billing;
- expanded AI tutor mode;
- support for many subjects and response formats;
- richer communications.

## Explicitly out of scope for the hackathon

- tutor marketplace;
- tutor ranking or matching;
- commission settlement;
- full acquiring or payment processing;
- video conferencing;
- complete accounting;
- medical, psychological or special-education diagnosis;
- automatic high-stakes grading without human oversight;
- replacement of a school, university or formal examination system;
- unrestricted general-purpose learner chatbot;
- training a foundation model from scratch;
- scraping copyrighted learning materials without permission;
- direct recruitment or messaging of minors by the project team.

## Cut order if delivery falls behind

Cut in this order:

1. status-only payment tracking;
2. schedule beyond a minimal upcoming-event view;
3. proactive notifications;
4. material upload beyond links;
5. next-task recommendation;
6. assignment-bound AI chat;
7. visual polish that does not affect usability.

Do not cut:

- secure role separation;
- assignment creation and submission;
- preservation of original learner answers;
- structured AI analysis and failure handling;
- tutor review/correction;
- confirmed progress update;
- reproducible deployment and documentation.

## Scope-change rule

Any addition that consumes more than a small, reversible task must answer:

1. Which user problem does it solve?
2. Which requirement ID supports it?
3. Does it improve the end-to-end demo or pilot?
4. What existing task will be delayed or removed?
5. How will it be tested?

If these answers are missing, the feature stays outside the sprint.

## Owner override — 21 September 2026

Owner explicitly requested implementation of all team proposals, including earlier P1/P2 and future features. Their former priority or out-of-scope label alone no longer blocks reversible local implementation. Real external messaging, publishing, financial actions, MAX live testing and access-dependent work remain restricted. Negative safety constraints (no high-stakes automatic grading or replacement claims) remain constraints, not feature requests. Full inventory: 30_TEAM_CHECKLIST_RU.md.
