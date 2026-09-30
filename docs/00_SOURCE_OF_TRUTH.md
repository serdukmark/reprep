# Source of truth and uncertainty policy

## Purpose

This document defines how to interpret project information and what to do when sources disagree.

## Source precedence

From highest to lowest authority:

1. Official hackathon case, rules and submission form.
2. Official MAX platform documentation applicable to the selected implementation.
3. Explicit written decisions made by the project owner and recorded in `16_DECISION_LOG.md`.
4. Approved product requirements in this repository.
5. User research evidence and pilot observations.
6. Proposed architecture and feature plans.
7. Mockups, presentations, brainstorms and historical discussion.

An older, lower-authority source must not override a newer, higher-authority source.

## Status labels

### `[CONFIRMED]`

An accepted decision or verified fact. It may be implemented and relied on.

### `[PROPOSED]`

A recommended direction that has not been fully confirmed. It may be explored when reversible, but must not be presented as an external fact.

### `[OPEN]`

No decision has been made. Agents must not silently choose an answer.

### `[ASSUMPTION]`

A temporary belief used to make progress. It must have a validation method and must be visible in code or documentation.

### `[OUT OF SCOPE]`

Explicitly excluded from the current delivery window.

### `[EXTERNAL CONFIRMATION REQUIRED]`

The team lacks authority or information to decide this alone.

## Known sources used for this pack

### Team-provided product description

`[CONFIRMED]` The owner-approved description and team, confirmed on 2026-09-28, are recorded in [22_PROJECT_PASSPORT_RU.md](22_PROJECT_PASSPORT_RU.md), decisions D-009–D-012 and [ADR-001](decisions/ADR-001_PROJECT_CONCEPT_AND_TEAM.md).

The platform combines scheduling, homework, materials, payments, communication and progress. Learner-contextual AI supports checking, explanations, gap identification and between-lesson help, including a standalone affordable AI-tutor direction. The business model is tutor and learner subscriptions, followed by commissions for tutor matching and payments through the platform.

The confirmed concept does not assert implementation readiness or resolve prices, provider choices, release timing or safety policy for standalone mode. Materials under `archive/` are superseded history and must not override the passport or decision log.

### Organizer webinar analyzed by the team

The webinar described the Dive → Create → Impact approach and stated or strongly emphasized:

- `[CONFIRMED]` build around a user problem rather than a technology;
- `[CONFIRMED]` produce a working bot or mini-application prototype appropriate to the case;
- `[CONFIRMED]` prepare a presentation and a complete submission package;
- `[CONFIRMED]` keep README and runtime instructions current;
- `[CONFIRMED]` ensure the solution starts without manual corrections and contains no committed secrets;
- `[CONFIRMED]` test on a clean environment or another computer;
- `[CONFIRMED]` use the case criteria as a checklist;
- `[CONFIRMED]` first-stage submission was announced for 30 September;
- `[OPEN]` exact submission time;
- `[OPEN]` exact artifact list;
- `[OPEN]` whether Docker is mandatory for this specific case;
- `[OPEN]` slide and presentation constraints.

### Track wording visible in supplied materials

The education direction asks for a digital product for schools or universities that supports new skills, early career navigation and a safe environment.

- `[OPEN][EXTERNAL CONFIRMATION REQUIRED]` whether independent tutors and their learners are accepted as sufficiently aligned with “schools or universities”.
- `[OPEN][EXTERNAL CONFIRMATION REQUIRED]` whether one of the three themes is sufficient or all must be addressed.

## Conflict procedure

If new official material conflicts with this pack:

1. preserve the official material or a link to it;
2. create an ADR describing the conflict;
3. update affected requirements;
4. update the open-question and decision logs;
5. identify affected code and data migrations;
6. do not hide the change by silently editing one document.

## Evidence standard

Use these evidence levels in product claims:

1. **Observed in product:** directly demonstrated in the MVP.
2. **Measured in test:** observed in a controlled usability or pilot session.
3. **Reported by participant:** stated by a tutor or learner.
4. **Supported by external source:** referenced research or market data.
5. **Hypothesis:** plausible but not yet demonstrated.

Claims in presentations, README and UI must not be presented at a stronger evidence level than the supporting material.

## Implementation update — 20 September 2026

The official education case is now available at `official/education-case.pdf`. Current verified implementation and remaining gates are in `22_MORNING_REPORT_RU.md`; case reconciliation in `24_CASE_AND_MAX_RU.md`. The historical open-question rows are superseded where explicitly resolved by the current section of `15_OPEN_QUESTIONS.md`. Owner authorized reversible overnight implementation, local commits only, no publication or real learner data.
