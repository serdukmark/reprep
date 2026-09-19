# Decision log

This is a compact project-level log. Material engineering decisions should also have a detailed ADR.

## Confirmed decisions

| ID | Decision | Rationale | Consequences |
|---|---|---|---|
| D-001 | Primary business user is an independent tutor working without an administrative team. | Team-defined product direction. | Optimize workflows for one tutor, not school administration. |
| D-002 | Primary learner is a school student, initially associated with OGE/EGE preparation. | Team-defined target audience. | Minor-data and mobile UX considerations are mandatory. |
| D-003 | Core differentiator is learner-contextual AI embedded in the learning workflow. | Product concept. | Generic chat alone does not satisfy the product vision. |
| D-004 | Core flow is assignment → submission → AI analysis → explanation → tutor review → progress update. | Smallest coherent proof of value. | P0 work must protect this flow. |
| D-005 | Tutor remains able to review and correct AI output. | Pedagogical control and safety. | AI results require review states and auditability. |
| D-006 | Marketplace and real payment processing are outside the hackathon scope. | Delivery focus. | Show only as future roadmap. |
| D-007 | The team aims to run a real pilot with at least one adult tutor before submission. | Stronger evidence than a synthetic demo alone. | Pilot, privacy and support work are first-class deliverables. |
| D-008 | Unknowns are marked rather than silently invented. | Reliability for human and agent contributors. | Open-question register is mandatory. |

## Proposed decisions pending confirmation

| ID | Proposal | Why proposed | Confirmation needed |
|---|---|---|---|
| P-001 | Use a MAX Mini App as the main surface and a bot only for reminders/deep links. | LMS workflow needs structured screens. | Official case/MAX platform confirmation. |
| P-002 | Use one subject and a narrow task set for the pilot. | Enables reliable AI evaluation. | Product owner and pilot tutor. |
| P-003 | Treat each tutor as an isolated workspace. | Simplifies authorization and pilot model. | Engineering review. |
| P-004 | Use a modular monolith rather than microservices. | Speed and operational simplicity. | Stack/architecture decision. |
| P-005 | Preserve original submissions and create new attempts for resubmission. | Auditability and data integrity. | Product policy. |
| P-006 | Use structured AI output and provider adapters. | Safety and replaceability. | Engineering approval/provider selection. |
| P-007 | Freeze new features on 28 September. | Protect final quality and submission. | Team agreement and official timing. |
| P-008 | Maintain separate synthetic demo and real pilot data. | Privacy and deterministic demo. | Engineering implementation. |

## Decision entry template

```md
### D-XXX — Title

- Status: proposed / confirmed / superseded / rejected
- Date:
- Owner:
- Source:
- Context:
- Decision:
- Rationale:
- Consequences:
- Alternatives considered:
- Follow-up:
```

## Overnight reversible implementation — 20 September 2026

- D-N01 [ASSUMPTION]: React/TypeScript + FastAPI/SQLite, one instance, persistent lease queue. ADR-001. Reversible local implementation explicitly authorized by owner; no stack approval inferred.
- D-N02 [ASSUMPTION]: one role per account; 72h single-use invitations; published content frozen, clone for editing; resubmit after return.
- D-N03 [ASSUMPTION]: feedback after teacher review; hints_first releases only teacher-authored hints. Supersedes immediate AI explanation in historical core-flow wording.
- D-N04 [CONFIRMED constraint / ASSUMPTION choice]: owner cap $1/M both directions. Qwen 3.8 Flash selected provisionally after live comparison and Gemini regression (2/6 on follow-up, including a Russian decimal-comma error); hard provider price cap, 50 external attempts/day. See AI report. Luna excluded for output price $1.20/M.
- D-N05 [CONFIRMED]: no push, merge, main changes, public deploy or outbound messages overnight. Live OpenRouter calls on synthetic fixtures explicitly authorized.
- D-N06 [CONFIRMED fact]: official PDF establishes bot or bot+MiniApp, Docker, 40/60 evaluation. External launch, final submission and human pilot remain unverified.

- D-N07 [CONFIRMED scope / ASSUMPTION implementation]: owner requested offline MAX integration. ADR-002: secret-checked webhook, bounded durable bot replies, Bridge, guarded external setup scripts. Real token/API/domain not used overnight; TLS/partner setup remain owner gates.
- D-N08 [ASSUMPTION]: 60KB UTF-8 AI context ceiling; longer work stays intact for manual review. No silent truncation; no automatic model-cost escalation.
