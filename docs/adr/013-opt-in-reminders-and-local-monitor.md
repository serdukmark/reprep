# ADR-013 — Opt-in reminders and read-only monitoring

Status: reversible implementation under the owner's overnight instruction (21 September 2026).

TEAM-022/078/091: reminders require an authenticated MAX identity, observed direct bot start, per-user opt-in and both MAX enable flags. Migration10 adds contact/settings/delivery metadata; existing preferences default off. Lessons: next hour; assignment deadlines: next day. Same recipient/kind/time is batched, queue capped at100. Delivery revalidates permissions, current preference and event state. Retry is bounded at three; failed/cancelled/sent counts are visible. Messages contain no learner names or solution content. Network acknowledgement loss may still cause duplicate delivery; exactly-once is not promised. Account export/deletion includes new metadata.

Local tests and four mutation checks use synthetic transport only. Actual MAX delivery remains unverified and disabled. Monitoring CLI checks database readiness, emits bounded JSON and exit status, never restarts or sends alerts. Permanent external monitoring needs the owner's server/channel choice (N-26/27).

The remaining feedback/context gaps TEAM-044/045/048 are also closed locally: useful/incorrect/harmful/bug reports; subject and teacher-entered level added to minimal assessment context. No aliases or plan goal are sent. Context format is recorded as assessment-context-v3; assessment-v2 system prompt unchanged. Previous paid evidence used the earlier context format; updated context not separately evaluated on real AI.
