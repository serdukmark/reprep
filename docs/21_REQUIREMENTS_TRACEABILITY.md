# Requirements traceability matrix

This matrix is a starting point. Update it as feature specs, code modules and tests are created.

| Product outcome | Requirement IDs | Primary evidence/test | Status |
|---|---|---|---|
| User is securely identified | FR-AUTH-001, FR-AUTH-002 | Session/auth integration tests | Proposed; identity mechanism open |
| Tutor data is isolated | FR-AUTH-003 | Cross-tutor authorization tests | Required |
| Tutor can invite learner | FR-AUTH-004 | Invite lifecycle E2E | Required; MAX delivery open |
| Tutor creates assignment | FR-ASG-001–004 | Assignment domain/UI tests | Required; task types open |
| Tutor publishes and assigns | FR-ASG-005–007 | Publish/version E2E | Required |
| Learner sees assigned work | FR-SUB-001 | Learner-safe API/UI E2E | Required |
| Learner work is not lost | FR-SUB-002–004 | Network/idempotency tests | Required |
| AI receives bounded context | FR-AI-001 | Context selection tests | Required |
| AI response is structured | FR-AI-002, FR-AI-003 | Schema/evaluation tests | Required |
| Learner receives useful explanation | FR-AI-004, FR-AI-005 | AI fixtures + user test | Required |
| Tutor controls AI result | FR-AI-006, FR-PROG-002 | Review/correction E2E | Required |
| AI failure is safe | FR-AI-008 | Timeout/invalid-output E2E | Required |
| Progress has traceable evidence | FR-PROG-001–003 | Evidence ledger tests | Required |
| Learner can understand progress | FR-PROG-004 | Usability testing | P1 |
| Product can propose next action | FR-PROG-005 | Tutor acceptance tests | P1 |
| Schedule/reminders work | FR-SCHED-001–002 | Integration tests | P1; platform open |
| Materials are safely attached | FR-MAT-001–003 | Access/file safety tests | P1; storage open |
| Payment wording is truthful | FR-PAY-001–002 | UI/copy tests | P1/manual status only |
| Pilot users can report problems | FR-FB-001 | Feedback flow test | P1 |
| Demo is deterministic | FR-DEMO-001 | Reset E2E | Required |
| Errors are supportable and safe | FR-OPS-001 | Error reference/log test | Required |

## Code traceability convention

Once modules exist, add columns for:

- implementation path;
- feature flag;
- test path;
- owner;
- release version;
- known defect/limitation.

Pull requests should mention requirement IDs rather than relying only on prose titles.
