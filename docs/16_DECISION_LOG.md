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
| D-009 | Current team: Дмитрий Ярочкин — CAIO; Иван Курбан — CTO; Марк Сердюк — CPO. | Explicit owner confirmation, 2026-09-28. | Supersedes team names in old roadmap cards; see ADR-001. |
| D-010 | Full platform combines scheduling, homework, materials, payments, communication and progress, with AI embedded in the context of each learner. | Owner-approved concept, 2026-09-28. | Canonical description: `22_PROJECT_PASSPORT_RU.md`; first-release priorities remain distinct. |
| D-011 | Business model: subscriptions for tutors and learners, followed by commissions for tutor matching and payments through the platform. | Explicit owner confirmation, 2026-09-28. | Replaces proposed-only monetization labels. Prices, rollout, usage limits and commission rates remain open; D-006 still applies to the hackathon. |
| D-012 | A more affordable standalone AI tutor is part of the confirmed product vision. | Explicit owner confirmation, 2026-09-28. | Does not change tutor-led P0 or assert availability. Standalone pedagogy, safety and release policy require specification under OQ-PROD-012. |

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
