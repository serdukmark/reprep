# reprep — repository documentation pack

This directory is a repository-ready documentation pack for **reprep**, an AI-native workspace for independent tutors and their students.

The pack is intentionally explicit about uncertainty. It must not be read as if every statement is already approved or technically validated.

## Product one-liner

> reprep helps an independent tutor run an individual learning cycle in one place: assign work, receive a submission, use AI to check and explain it in the context of the learner, approve the result, and track skill gaps over time.

## Current objective

Build a pilot-ready MAX-based product for the education track of the MAX hackathon and run at least one real, safely conducted pilot with an adult tutor before submission.

## Start here

1. Read [`AGENTS.md`](./AGENTS.md) before changing code or documentation.
2. Read [`docs/00_SOURCE_OF_TRUTH.md`](./docs/00_SOURCE_OF_TRUTH.md) to understand status labels.
3. Read [`docs/01_PRODUCT_VISION.md`](./docs/01_PRODUCT_VISION.md) and [`docs/02_PRD.md`](./docs/02_PRD.md).
4. Check [`docs/15_OPEN_QUESTIONS.md`](./docs/15_OPEN_QUESTIONS.md) before making a decision that is not documented.
5. Check [`docs/16_DECISION_LOG.md`](./docs/16_DECISION_LOG.md) before revisiting an existing decision.

## Documentation map

| File | Purpose |
|---|---|
| `AGENTS.md` | Mandatory operating rules for coding agents and contributors |
| `docs/00_SOURCE_OF_TRUTH.md` | Status system, precedence and uncertainty rules |
| `docs/01_PRODUCT_VISION.md` | Product vision, positioning and strategic boundaries |
| `docs/02_PRD.md` | Product requirements document and success definition |
| `docs/03_SCOPE_AND_PRIORITIES.md` | P0/P1/P2 scope and explicit non-goals |
| `docs/04_USERS_AND_JOURNEYS.md` | Users, jobs, journeys and edge cases |
| `docs/05_FUNCTIONAL_REQUIREMENTS.md` | Detailed functional requirements with IDs |
| `docs/06_AI_SYSTEM_SPEC.md` | AI responsibilities, context, outputs, safety and evaluation |
| `docs/07_DOMAIN_AND_DATA_MODEL.md` | Domain concepts, proposed entities and lifecycle rules |
| `docs/08_API_AND_EVENTS.md` | Conceptual API boundaries and analytics events |
| `docs/09_ARCHITECTURE_AND_INTEGRATIONS.md` | Architecture constraints and unresolved technology choices |
| `docs/10_SECURITY_PRIVACY_SAFETY.md` | Security, privacy, minor safety and content handling |
| `docs/11_UX_UI_REQUIREMENTS.md` | UX principles, screens and state requirements |
| `docs/12_TESTING_AND_ACCEPTANCE.md` | Testing strategy and release acceptance gates |
| `docs/13_RESEARCH_METRICS_PILOT.md` | CustDev, metrics and first-client pilot protocol |
| `docs/14_DELIVERY_AND_SUBMISSION.md` | Delivery workflow, releases and hackathon package |
| `docs/15_OPEN_QUESTIONS.md` | Questions that must not be silently answered by agents |
| `docs/16_DECISION_LOG.md` | Confirmed and proposed decisions with rationale |
| `docs/17_GLOSSARY.md` | Shared vocabulary |
| `docs/assets/roadmap-cards/` | Team roadmap cards in PNG format |
| `docs/templates/` | Templates for ADRs, features, test reports and pilot notes |

## Current status snapshot

- **Confirmed product direction:** independent tutors and school students, initially focused on exam preparation.
- **Confirmed differentiator:** AI is embedded in the learning workflow and uses the context of an individual learner.
- **Confirmed core flow:** assignment → submission → AI analysis → learner explanation → tutor review → progress update.
- **Proposed delivery surface:** MAX Mini App, with an optional bot for notifications. This still needs confirmation against the exact case rules.
- **Pilot target:** one adult tutor and a small number of learners, using at least one real assignment.
- **Submission date heard in the organizer webinar:** 30 September. Exact time and authoritative artifact list remain open.

## Important warning

This pack contains product and engineering requirements, but it does **not** replace the official hackathon case, rules, submission form or MAX technical documentation. When authoritative materials become available, add them to the repository as references and resolve the corresponding open questions.
