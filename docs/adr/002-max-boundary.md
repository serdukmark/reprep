# ADR-002: MAX boundary prepared offline

- Date: 2026-09-20
- Status: implemented locally, external verification pending.
- Authorization: owner explicitly requested MAX auth, bot handlers, webhook and embedding preparation; prohibited token-backed MAX calls, registration and deployment overnight.

Use the current documented platform-api2.max.ru API behind MaxAPI, with TLS verification and optional operator-provided CA bundle. Webhook checks X-Max-Bot-Api-Secret; this is a shared secret header, not a fabricated body-signature algorithm. InitData uses the distinct official double-HMAC verification and a conservative 300-second TTL.

Persist canonical update hashes and minimal outbound replies in SQLite max_outbox, not raw incoming events. Return 200 after durable enqueue, process separately with at most three attempts. Pending queue capped at 100, per-recipient ingress at 10/min. Outbound disabled by default and never enabled in the night environment. Crash after send/before commit can duplicate a reply; exactly-once is not claimed.

Schema v2 adds max_outbox; existing learning tables and records remain compatible. No migration deletes user data. To roll back feature use flags; downgrade leaves the unused table intact.

Load official MAX Bridge only for a MAX launch. Use raw initData, BackButton and closing confirmation. Keep same-origin browser API; allow MAX framing in CSP, omit X-Frame-Options denial, handle unavailable sessionStorage with in-memory session. A denied storage environment requires login again after reload; saved drafts stay server-side.

Validation: frozen Node-generated HMAC fixture, endpoint negative tests, two mutation controls, mocked transport, local iframe/Bridge browser tests. These do not prove real MAX API, TLS chain, partner registration, open_app or mobile/web client behavior. External gates and operator steps: ../26_MAX_START_RU.md.

Related resilience change: requests capped at 150000 bytes including streamed bodies; assessment context over 60000 UTF-8 bytes remains manual with original preserved. Empty, oversized and invalid provider content is not treated as a grade. This avoids truncating learner work while preserving a recoverable path.
