# Functional requirements

Requirement IDs are stable references for tasks, tests and pull requests.

## Authentication and authorization

### FR-AUTH-001 — identify current user `[P0]`

The system shall identify a current user through the selected access mechanism.

- `[OPEN]` MAX identity versus project-managed authentication versus demo access.
- The server must not trust role or user ID supplied only by the client.

### FR-AUTH-002 — support tutor and learner roles `[P0]`

A user shall act as a tutor or learner according to authorized relationships.

- `[OPEN]` whether one account may hold both roles.

### FR-AUTH-003 — isolate tutor data `[P0]`

A tutor shall access only learners, assignments and materials authorized for that tutor.

### FR-AUTH-004 — invitation lifecycle `[P0]`

The system shall support a tutor-created learner invitation with states such as created, accepted, declined, expired and revoked.

- Exact delivery channel and expiration are `[OPEN]`.

## Tutor and learner profiles

### FR-PROFILE-001 — minimal tutor profile `[P0]`

Store only fields required for product operation and pilot support.

### FR-PROFILE-002 — minimal learner profile `[P0]`

The learner profile shall avoid unnecessary identifying information.

- `[OPEN]` age/date-of-birth requirements;
- `[OPEN]` guardian-related fields;
- `[OPEN]` display-name policy.

### FR-PROFILE-003 — subject context `[P0]`

A tutor-learner relationship shall be associated with at least one subject or learning program.

## Assignments

### FR-ASG-001 — create draft `[P0]`

Tutor shall create an assignment draft with title, instructions and tasks.

### FR-ASG-002 — supported task types `[P0]`

The system shall support only explicitly implemented and tested task types.

- `[OPEN]` exact P0 task types;
- candidates include single choice, multiple choice, short text and numeric response;
- free-form essays, handwritten images and file submissions require separate approval and evaluation design.

### FR-ASG-003 — evaluation reference `[P0]`

Each AI-assessed task shall have sufficient evaluation context, such as an answer key, rubric, allowed variants or tutor instruction.

### FR-ASG-004 — skill tags `[P0]`

Tutor or system shall associate tasks with skill identifiers when progress tracking depends on them.

AI-proposed skill tags must not become trusted taxonomy without tutor confirmation.

### FR-ASG-005 — preview `[P1]`

Tutor should preview learner-visible assignment content before publication.

### FR-ASG-006 — publish and assign `[P0]`

Tutor shall assign a published assignment to one authorized learner with a due date or explicit no-deadline state.

- `[P2]` assignment to multiple learners or groups.

### FR-ASG-007 — publication changes `[P0]`

The system shall prevent or record changes that would invalidate existing submissions.

Exact versioning behavior is `[OPEN]`.

## Learner submission

### FR-SUB-001 — list assigned work `[P0]`

Learner shall see active, completed and relevant overdue assignments.

### FR-SUB-002 — save progress `[P0]`

The product shall prevent accidental loss of in-progress answers through autosave or an explicit reliable save mechanism.

### FR-SUB-003 — final submit `[P0]`

Learner shall intentionally submit work and receive confirmation.

### FR-SUB-004 — preserve original `[P0]`

The system shall preserve the original submitted content separately from AI and tutor annotations.

### FR-SUB-005 — resubmission `[OPEN]`

Policy for retries, correction attempts and deadlines must be decided per assignment or globally.

## AI analysis and feedback

### FR-AI-001 — create bounded context `[P0]`

The system shall assemble only the context required by the approved AI specification.

### FR-AI-002 — structured output `[P0]`

AI output shall validate against a versioned schema.

### FR-AI-003 — assessment states `[P0]`

The system shall support at least:

- assessed;
- partially assessed;
- cannot assess;
- provider unavailable;
- output invalid;
- awaiting tutor review.

### FR-AI-004 — explanation `[P0]`

When assessment is supported, the product shall provide a concise explanation grounded in the task and rubric.

### FR-AI-005 — hint policy `[P0]`

The system shall support hint-first behavior where configured and shall not always reveal the final answer immediately.

### FR-AI-006 — tutor review `[P0]`

Tutor shall view, confirm, edit or reject AI analysis.

### FR-AI-007 — feedback release policy `[OPEN]`

Decide whether learner sees AI feedback immediately, only after tutor approval, or according to tutor configuration.

### FR-AI-008 — provider failure `[P0]`

A failed AI request shall not lose the learner submission or block tutor manual review.

## Progress and skills

### FR-PROG-001 — evidence records `[P0]`

Progress shall be based on identifiable assignment/task evidence rather than an unexplained AI summary.

### FR-PROG-002 — confirmation state `[P0]`

Skill evidence shall distinguish AI-proposed, tutor-confirmed, tutor-corrected and rejected states.

### FR-PROG-003 — tutor view `[P0]`

Tutor shall see assignment results and a learner skill summary.

### FR-PROG-004 — learner view `[P1]`

Learner should see understandable progress without harmful ranking or unsupported prediction.

### FR-PROG-005 — next action `[P1]`

System may propose a next task or topic. It must be labelled as a recommendation and remain tutor-controlled.

## Schedule and reminders

### FR-SCHED-001 — lesson schedule `[P1]`

Tutor may create upcoming lesson records visible to the learner.

### FR-SCHED-002 — reminders `[P1]`

System may send reminders through an approved MAX mechanism.

- `[OPEN]` platform capability, user consent and rate limits.

## Materials

### FR-MAT-001 — material links `[P1]`

Tutor may attach approved links to a learner, assignment or lesson.

### FR-MAT-002 — file upload `[P1][OPEN]`

File upload depends on storage, security scanning, limits and MAX integration decisions.

### FR-MAT-003 — AI use of materials `[OPEN]`

Do not send or index tutor materials for AI until copyright, provider, retention and retrieval behavior are defined.

## Payment status

### FR-PAY-001 — manual status `[P1]`

Tutor may record a non-financial status such as unpaid, paid or waived for personal tracking.

The product shall not imply that it processed money.

### FR-PAY-002 — real payment processing `[OUT OF SCOPE]`

No real payment capture, payout, commission or financial reconciliation in the hackathon scope.

## Feedback and pilot operations

### FR-FB-001 — user feedback `[P1]`

Tutor and learner should be able to rate usefulness or report a problem in context.

### FR-DEMO-001 — resettable demo `[P0]`

The team shall maintain synthetic demonstration data and a reliable way to restore it.

### FR-OPS-001 — traceable errors `[P0]`

User-visible errors shall provide a non-sensitive reference ID that can be located in logs.

## Owner-approved file extension — 21 September 2026

TEAM-032: learner TXT attachments are implemented per ADR-007: three files, total 60 KB, versioned private drafts, immutable submission snapshots and history. Text participates in bounded AI assessment. Other formats and OCR remain open.
