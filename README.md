# reprep — AI-native platform for tutors and learners

**reprep** is an AI-native platform for independent tutors and learners that brings scheduling, homework, materials, payments, communication and progress tracking into one place.

AI helps check assignments, explain mistakes, identify learning gaps and support learners between lessons using each learner's context. The product vision also includes a more affordable standalone AI tutor. The initial audience is independent tutors and school students, especially those preparing for OGE/EGE.

## Product one-liner

> reprep combines a tutor's daily work and a learner's study process in one platform, with AI embedded in the context of each learner.

The intended distinction from ordinary LMS products and marketplaces is learner-contextual AI embedded in the learning process. The business model is **subscriptions for tutors and learners**, followed by **commissions for tutor matching and payments through the platform**. Prices, usage limits and rollout order remain open.

## Team

| Member | Role |
|---|---|
| Дмитрий Ярочкин | CAIO |
| Иван Курбан | CTO |
| Марк Сердюк | CPO |

See the [owner-approved project passport in Russian](docs/22_PROJECT_PASSPORT_RU.md). The concept describes the intended product, not completed features or validated commercial results.

## Current objective

Build a pilot-ready MAX-based product for the education track of the MAX hackathon and run at least one real, safely conducted pilot with an adult tutor before submission.

The first release focuses on the tutor-led learning cycle: assignment, submission, AI analysis, explanation, tutor review and confirmed progress. Scheduling, materials, communication and payment status support that workflow. Standalone AI tutoring and subscription billing are later expansion work; matching, payment processing and commissions remain outside the current hackathon scope. These release boundaries do not narrow the full product vision.

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
| `docs/20_TEAM_BRIEF_RU.md` | Current team and product brief in Russian |
| `docs/22_PROJECT_PASSPORT_RU.md` | Canonical owner-approved project description and team |
| `docs/decisions/` | Detailed records of accepted product and architecture decisions |
| `docs/archive/` | Superseded historical materials, not current requirements |
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
