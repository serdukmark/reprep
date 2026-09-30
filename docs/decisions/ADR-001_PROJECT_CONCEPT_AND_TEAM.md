# ADR-001: Align project concept and team with the owner's description

- Status: accepted
- Date: 2026-09-28
- Owner: Марк Сердюк, CPO
- Source: project owner's explicit description and request to update and push repository documentation on 2026-09-28
- Related decisions: D-009, D-010, D-011, D-012
- Related questions: OQ-BIZ-001–004, OQ-BIZ-007, OQ-PROD-012
- Related requirements: FR-PAY-001–002 and the existing P0 learning flow; no implementation change

## Context

The old documentation emphasizes the first tutor-led learning cycle, lists subscriptions as proposed, and includes roadmap images with an obsolete team. The owner confirmed a broader platform concept, both tutor and learner subscriptions, a standalone AI-tutor direction, future commissions, and the current team.

## Decision

Use [the Russian project passport](../22_PROJECT_PASSPORT_RU.md) as the canonical owner-approved description. The team is Дмитрий Ярочкин (CAIO), Иван Курбан (CTO), Марк Сердюк (CPO).

The platform combines scheduling, homework, materials, payments, communication and progress. Learner-contextual AI supports checking, explanations, gap identification and between-lesson help. An affordable standalone AI tutor is part of the confirmed vision. Monetization is subscriptions for tutors and learners, followed by commissions for tutor matching and payments through the platform.

Keep the existing delivery priorities distinct from this vision. This decision does not mark features implemented, select prices or providers, approve minor-data processing, or move matching and payment processing into the hackathon release. The tutor-led P0 review policy continues to apply to that mode. Standalone-mode review and safety policy require a separate decision.

## Alternatives considered

- Keep the narrow one-liner and proposed monetization labels: rejected because they no longer reflect the owner's confirmed concept.
- Treat the whole vision as immediate P0 scope: rejected because the owner confirmed the concept, not a new implementation deadline or acceptance criteria.
- Rewrite old PNG plans in place: archive them instead to retain the historical plan without presenting its old team and dates as current instructions.

## Consequences

- Product: align entry points, vision, PRD, personas, team brief and business descriptions.
- Engineering: existing P0/P1 requirements remain in force; standalone mode needs its own requirements before implementation.
- Data/security: no new permissions or migrations. Existing tutor-workspace isolation applies to the first release.
- Operations: historical roadmap cards move into a labelled archive.
- Documentation: record decisions and keep unresolved pricing and launch details open.

## Validation and rollback

Review the active documentation against the exact owner description, check relative links and search for obsolete team names and superseded monetization labels. Changes are documentation-only and reversible through Git. Preserve this ADR if a later decision supersedes it.
