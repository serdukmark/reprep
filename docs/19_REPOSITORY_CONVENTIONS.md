# Repository and agent workflow conventions

These are proposed defaults until the engineering team records final choices.

## 1. Suggested repository layout

```text
/
├── AGENTS.md
├── README.md
├── docs/
├── apps/
│   ├── client/          # MAX Mini App or web client
│   └── server/          # application backend
├── packages/
│   ├── contracts/       # shared API/schema definitions
│   ├── domain/          # optional framework-independent domain code
│   └── ui/              # optional shared UI components
├── infra/               # deployment/container configuration
├── tests/
│   ├── e2e/
│   └── fixtures/
└── scripts/             # safe project automation
```

This layout is `[PROPOSED]`; adapt it to the selected stack without losing boundaries.

## 2. Naming and traceability

- Reference requirement IDs in task/PR descriptions.
- Use stable domain language from `17_GLOSSARY.md`.
- Do not call preliminary AI output a final grade.
- Distinguish `submission`, `answer`, `analysis`, `review` and `evidence` in names.
- Name provider implementations by adapter, not throughout domain code.

## 3. Task format

Every implementation task should include:

- objective;
- requirement IDs;
- user/actor;
- in-scope behavior;
- out-of-scope behavior;
- acceptance criteria;
- error/empty/loading states;
- security/privacy considerations;
- dependencies/open questions;
- test plan;
- documentation impact.

Use `templates/FEATURE_SPEC_TEMPLATE.md`.

## 4. Pull request expectations

Each PR should state:

- what changed and why;
- requirements covered;
- screenshots or demo steps for UI;
- schema/API migration impact;
- tests run;
- security/privacy impact;
- open questions or follow-ups;
- documentation updated.

## 5. Generated code

When using Codex, Claude Code or another agent:

- provide the relevant docs and requirement IDs;
- ask for a plan before large cross-module changes;
- require tests and manual verification steps;
- inspect dependency additions;
- inspect authorization paths;
- reject fabricated SDK methods or undocumented APIs;
- verify generated migrations and destructive operations;
- do not let agents resolve `[OPEN]` items by choosing convenient defaults silently.

## 6. Dependencies

Before adding a dependency:

- explain its purpose;
- verify license and maintenance status when possible;
- avoid multiple libraries for the same responsibility;
- pin/lock versions according to stack conventions;
- consider client bundle and security impact;
- document external services and configuration.

## 7. Database changes

- use migrations;
- make destructive changes explicit;
- preserve original submissions and evidence;
- document backfill requirements;
- do not edit production/pilot data manually without an auditable procedure;
- test migrations from a realistic previous state.

## 8. API changes

- update shared contract/schema;
- update server and client together or maintain compatibility;
- add authorization tests;
- document breaking changes;
- do not leak tutor-only fields to learner contracts.

## 9. Feature flags

Use flags for:

- incomplete user-visible capabilities;
- provider-dependent integrations;
- risky AI behavior;
- pilot-only tools;
- demo reset.

Flags must have an owner, default and removal plan.

## 10. Documentation definition of done

A change is not done until:

- requirement status reflects reality;
- open questions are updated;
- architecture/ADR is updated if needed;
- README commands are current;
- demo/pilot instructions remain valid.
