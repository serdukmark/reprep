# Product vision

## Vision

`[CONFIRMED]` reprep is an AI-native platform for independent tutors and learners that combines scheduling, homework, materials, payments, communication and progress tracking. AI helps check assignments, explain mistakes, identify learning gaps and support learners between lessons using the context of each learner. The vision also includes a more affordable standalone AI tutor.

The target audience is independent tutors and school students, initially emphasizing OGE/EGE preparation. See the [canonical project passport and team](22_PROJECT_PASSPORT_RU.md), confirmed by the owner on 2026-09-28. This is the intended product, not a claim that all capabilities are implemented.

## Product promise

For tutors:

> Spend less time on routine administration and first-pass checking while retaining control over pedagogy and final feedback.

For learners:

> Receive timely, understandable help between lessons without losing the connection to the tutor's materials, expectations and learning plan.

## Target users

### Primary

- `[CONFIRMED]` independent tutors working alone;
- `[CONFIRMED]` school students, initially with emphasis on preparation for OGE/EGE;
- `[PROPOSED]` tutors with roughly several to several dozen active learners are the most relevant early customer profile;
- `[OPEN]` exact tutor segment, subject and minimum/maximum learner count for the first pilot.

### Secondary or future

- parents or guardians;
- small tutoring teams;
- schools, universities or educational centers;
- learners using an affordable standalone AI tutor;
- tutors discovered through a future marketplace.

These users are not primary for the current P0 scope.

The standalone AI tutor is a confirmed product direction, not an unapproved idea. Its placement outside P0 describes release sequencing only. Its pedagogy, review policy, data permissions and pricing remain open; tutor-led review rules must not be silently removed to implement it.

## Problem statement

`[ASSUMPTION]` Independent tutors commonly combine multiple tools for scheduling, materials, homework, payments and communication. This can fragment learner context and make routine checking and progress tracking expensive.

This problem must be validated through interviews and a pilot. The repository must not claim universal prevalence until evidence is recorded.

## Differentiation

`[CONFIRMED]` The intended difference from a generic LMS or tutor marketplace is that AI is embedded in the learning process and uses learner-specific context.

The differentiator is not “contains a chatbot”. It is the closed loop:

1. tutor defines learning intent and task;
2. learner submits work;
3. AI analyzes against task criteria and learner context;
4. learner receives a pedagogically appropriate explanation;
5. tutor reviews or corrects the analysis;
6. validated results update the learner's skill profile;
7. the next learning action can use that profile.

## Hackathon positioning

`[PROPOSED]` Position reprep as a safe AI-supported environment for developing academic skills under human tutor control.

Do not artificially add career-navigation features unless official case interpretation requires them.

## Business model

### Current direction

- `[CONFIRMED]` subscriptions for tutors;
- `[CONFIRMED]` subscriptions for learners, including the standalone AI-support direction;
- `[CONFIRMED]` future commissions for tutor matching and payments through the platform.

These are confirmed business-model directions, not validated demand or currently operating payment services. Tutor and learner subscriptions do not by themselves determine whether both must pay for the same learning cycle.

### Unknowns

- `[OPEN]` price and billing period;
- `[OPEN]` who pays first: tutor, learner or parent;
- `[OPEN]` free tier or trial policy;
- `[OPEN]` AI usage limits;
- `[OPEN]` unit economics and provider costs;
- `[OPEN]` payment processor and legal structure.

No price or revenue claim should be coded as final or shown as validated without a decision.

## North-star concept

`[PROPOSED]` A meaningful long-term north-star metric could be the number of completed learning cycles that produce tutor-confirmed learner progress.

The exact north-star metric remains `[OPEN]` pending pilot evidence.

## Strategic principles

1. Human educator remains in control.
2. AI uses bounded, relevant context.
3. Learning value precedes operational breadth.
4. The core workflow must work before secondary modules.
5. Claims are evidence-based.
6. Safety and privacy are product features, not post-launch tasks.
7. The architecture should allow provider replacement without rewriting core domain logic.
