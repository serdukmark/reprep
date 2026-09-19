# ADR-001 — Working MVP implementation

- Status: accepted for reversible development; production choices remain open
- Date: 2026-09-20
- Authority: owner asked to develop the product maximally and accumulate product questions.
- Requirements: FR-AUTH, FR-ASG, FR-SUB, FR-AI, FR-PROG, FR-DEMO, FR-OPS.

## Decision

Use a modular Python/FastAPI backend, SQLite with numbered migrations, and React/TypeScript/Vite client. One process serves the compiled client and API; SQLite is a single-instance development/demo database, not a chosen hosting provider. Docker provides reproducible isolated execution. These are engineering working decisions under the owner's development instruction (OQ-TECH-001/002/003/006/009); replace SQLite before horizontal scaling.

Use distinct tutor workspaces and bearer sessions with hashed tokens. MAX launch data is verified server-side by the official HMAC algorithm; demo sessions are available only in explicitly enabled development/demo environments. No contact with users or notification subscriptions is performed by setup.

Working assumptions, NOT permanent product decisions:
- synthetic mathematics examples; numeric, single-choice and short-text tasks;
- one role per account, expiring single-use invitations;
- published assignments immutable, duplication creates a new draft;
- one submission per assignment; tutor can return work for a new immutable attempt;
- tutor chooses `after_review` or `hints_first`; default is approval first;
- rubric-only short text requires manual review unless an approved provider is configured;
- no external learner data processing; AI-provider choice remains open. Local rules are explicitly labelled as rules, not a live neural model.

Every durable skill observation comes from a tutor review, never from a preliminary suggestion. Original submissions and review history are separate append-only records. Draft updates use revisions to reject stale writes. No uploads, marketplace, acquiring, video calls or unrestricted chat.

## Official case reconciliation

Source: `docs/official/education-case.pdf`, supplied in team topic, downloaded 2026-09-19.
- pp. 2,5–7: education participants broadly; directions are context, not mandatory simultaneous features. The earlier schools/universities-only interpretation is superseded; no claim of organizer approval of this specific product.
- p.7: bot OR bot with Mini App, main flow must work on mobile and web MAX.
- pp.9–10: Docker mandatory; dependencies, source commit, README, running MAX product, PDF presentation. Own API requires HTTPS, OpenAPI, test identities/data and DATA-API.yaml.
- pp.12–13: online product 40%, technical 60%, platform bonus 0.15. Own API alone earns no bonus.
- p.15: organizer supplies bot token.
Exact submission time/form, third-party AI interpretation and external hosting still require confirmation. No real token goes into repository or public artifacts.

## Validation and rollback

Test full workflow, authorization, lost responses, immutable answers, approval/rejection, malformed AI, MAX signatures and demo gates. Browser test desktop/mobile. Retain original proposals; this ADR overrides only the development choices above. No existing application data to migrate on initial install.

## Remaining release gates

Selected shared HTTPS environment, actual MAX webview check, approved AI provider/privacy terms, adult pilot and human engineering review. A local build does not close these gates.

## Update: actual AI and queue verification

Qwen 3.8 Flash via OpenRouter is the reversible demo default after Gemini regression on Russian decimal notation; price cap and measured outputs are in ../23_AI_MODEL_COMPARISON_RU.md. Remote data remains synthetic-only. AI_DAILY_LIMIT=50 is persisted through audit reservations before requests. SQLite claim/finish/reservation run outside the asyncio event loop: Docker browser testing exposed lock waits that blocked request cleanup; the worker was corrected and the full Docker flow passed. No production scaling claim.
