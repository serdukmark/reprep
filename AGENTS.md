# AGENTS.md — mandatory rules for work on reprep

These instructions apply to all coding agents and human contributors in this repository.

## 1. Read before acting

Before implementing or changing a feature:

1. Read `README.md`.
2. Read `docs/00_SOURCE_OF_TRUTH.md`.
3. Read the relevant product, AI, security, UX and testing documents.
4. Search `docs/15_OPEN_QUESTIONS.md` for unresolved decisions.
5. Search `docs/16_DECISION_LOG.md` for an existing decision.

For product descriptions and team information, also read `docs/22_PROJECT_PASSPORT_RU.md`. It records the owner's confirmed concept and current team. Keep the full platform vision distinct from first-release scope. Do not treat archived roadmap images in `docs/archive/` as current requirements or team assignments.

Do not infer approval from an idea appearing in a roadmap, mockup, presentation or old conversation.

## 2. Status labels are binding

The documentation uses these labels:

- `[CONFIRMED]` — accepted project decision or verified fact.
- `[PROPOSED]` — current recommendation; implementation may proceed only when it is reversible or explicitly assigned.
- `[OPEN]` — unresolved. Do not silently decide it.
- `[ASSUMPTION]` — working assumption that must remain visible and testable.
- `[OUT OF SCOPE]` — do not implement during the current hackathon scope.
- `[EXTERNAL CONFIRMATION REQUIRED]` — requires an organizer, platform owner, legal/privacy owner, client or other external authority.

If a requirement is unlabelled, treat it as descriptive context, not permission to make an irreversible product decision.

## 3. Never invent missing information

Do not invent or guess:

- official hackathon requirements;
- MAX SDK capabilities or limitations;
- submission artifacts, deadlines or presentation timing;
- credentials, tokens, endpoints or provider names;
- AI provider, model or pricing;
- hosting, database or storage vendor;
- legal basis for processing data about minors;
- consent from tutors, students or parents;
- the first pilot client's identity, subject or student count;
- benchmark results, user research findings or product metrics;
- unsupported claims about learning outcomes.

When blocked by an unknown:

1. Add or update an item in `docs/15_OPEN_QUESTIONS.md`.
2. Implement behind an interface, adapter, configuration value or feature flag if safe.
3. Use a clearly labelled mock or fixture only when it cannot be confused with production behavior.
4. State the unknown in the pull request or task summary.

## 4. Scope discipline

The P0 core flow is:

> Tutor assigns work → learner submits → AI analyzes → learner receives an explanation → tutor reviews/corrects → learner progress is updated.

Do not prioritize secondary features while any P0 step is unreliable.

Do not implement the current out-of-scope items unless `docs/03_SCOPE_AND_PRIORITIES.md` and the decision log are explicitly changed.

## 5. AI-specific rules

AI output is advisory, not an authoritative grade or pedagogical decision.

The requirements below apply to the tutor-led first release. The confirmed standalone AI-tutor direction needs separate pedagogy, review, progress and safety requirements before implementation (OQ-PROD-012); its existence does not authorize removing tutor review from the current flow.

Required behavior:

- use the narrowest necessary learner context;
- use teacher-provided answer keys or rubrics when available;
- return structured output validated against a schema;
- expose uncertainty or inability to assess;
- never fabricate source material or learner history;
- support tutor review and correction;
- keep prompts and evaluation fixtures versioned;
- provide a deterministic fallback when AI is unavailable;
- avoid immediately revealing final answers when a hint is pedagogically appropriate;
- never claim that AI has diagnosed a medical, psychological or protected condition.

Do not send personal data to an AI provider until the provider, data fields and legal/privacy approach are explicitly approved.

## 6. Minors and sensitive data

The target audience includes school students and may include minors.

Until an approved data policy exists:

- use synthetic or anonymized demo data;
- collect the minimum necessary information;
- do not require a full legal name, precise location, school name, phone number or other unnecessary identifier;
- do not place real student data in code, fixtures, logs, screenshots or presentations;
- do not contact minors directly for recruitment;
- conduct pilots through an adult tutor and obtain any required parent/guardian permission;
- support data deletion and access control in the architecture, even if the final retention period is open.

## 7. Engineering quality

A feature is not done because it works locally.

Definition of done:

- integrated into the shared product flow;
- deployed to the agreed test environment;
- critical logic covered by automated tests;
- loading, empty, success, validation and failure states handled;
- authorization checked server-side;
- no secrets or real client data committed;
- documentation updated;
- acceptance criteria demonstrated;
- no regression in the end-to-end P0 flow.

All generated code must be reviewed by a responsible engineer. Agent-generated tests must be inspected to ensure they test requirements rather than mirror implementation mistakes.

## 8. Interfaces and unresolved providers

Keep external systems behind adapters:

- AI provider;
- MAX platform identity and notifications;
- file storage;
- email or other messaging;
- analytics;
- payments, if ever added.

Provider-specific code must not leak into core domain logic.

## 9. Changes to requirements

For a material product or architecture change:

1. Create an ADR from `docs/templates/ADR_TEMPLATE.md`.
2. Update the relevant requirement documents.
3. Update `docs/16_DECISION_LOG.md`.
4. Add migration or compatibility notes if data or APIs change.

Do not quietly reinterpret an existing requirement in code.

## 10. Branch and integration expectations

- Keep changes small enough to review.
- Rebase or update before integration according to the repository workflow once chosen.
- Do not mix unrelated refactors with feature work.
- Keep the main branch deployable.
- Use feature flags for incomplete user-visible work.
- Record breaking API or schema changes.

The exact branching and CI provider are `[OPEN]` until selected.

## 11. Documentation maintenance

Documentation and code must evolve together.

When implementation diverges from a proposal:

- do not rewrite history;
- mark the proposal superseded;
- record the new decision and rationale;
- keep unresolved implications visible.

## 12. Completion reports

Every completed agent task should report:

- what changed;
- which requirement IDs were implemented;
- files changed;
- tests run and results;
- unresolved risks or questions;
- whether documentation changed;
- how to verify the feature manually.
