# API boundaries and product events

This is a conceptual contract. Protocol, framework, path naming and generated clients are `[OPEN]`.

## 1. API principles

- authorize every resource on the server;
- use stable internal IDs;
- never accept tutor or learner scope solely from client input;
- make submission and AI-trigger operations idempotent where retries are possible;
- return structured error codes plus a safe reference ID;
- use pagination for growing collections;
- version breaking contracts;
- avoid returning tutor-only rubrics or answer keys to learner clients;
- avoid provider-specific fields in public contracts;
- keep timestamps timezone-aware and machine-readable.

## 2. Conceptual capability groups

### Identity and session

- get current session/user;
- select or inspect authorized role;
- end session if applicable;
- obtain demo session only in approved environments.

### Relationships and invitations

- create invitation;
- inspect invitation safely;
- accept/decline/revoke;
- list tutor learners;
- inspect learner summary within authorization scope.

### Assignments

- create/update draft;
- add/reorder/remove task in draft;
- preview;
- publish/version;
- assign to learner;
- list tutor assignments;
- list learner work;
- get learner-safe assignment view;
- archive.

### Submissions

- create or load in-progress attempt;
- save answers;
- finalize submission idempotently;
- inspect status;
- list attempts according to policy.

### AI analysis

- request or enqueue analysis;
- inspect analysis status;
- obtain learner-safe feedback according to release policy;
- obtain tutor review view;
- confirm, correct or reject analysis;
- retry eligible failure.

### Progress

- get tutor learner progress;
- get learner-safe progress;
- get evidence details;
- get proposed next actions.

### Schedule and materials `[P1]`

- create/update/list lesson events;
- attach/list authorized materials;
- manage reminder preference/status;
- upload through an approved storage flow if implemented.

### Payment status `[P1]`

- create/update/list manual non-financial status records.

### Feedback and operations

- submit contextual feedback;
- request demo reset through an authorized internal mechanism;
- expose health/readiness checks without secrets.

## 3. Proposed error envelope

```json
{
  "error": {
    "code": "STABLE_MACHINE_CODE",
    "message": "Safe user-facing message",
    "reference_id": "non-sensitive-id",
    "details": {}
  }
}
```

`details` must not expose stack traces, secrets, answer keys or another user's data.

## 4. Idempotency candidates

- invitation creation where double-clicks are possible;
- final assignment publication;
- final submission;
- AI analysis request;
- tutor confirmation;
- notification dispatch.

Exact mechanism is `[OPEN]`.

## 5. Product event taxonomy

Event collection requires privacy review and must not include raw learner answers by default.

### Onboarding

- `tutor_onboarding_started`
- `tutor_onboarding_completed`
- `learner_invitation_created`
- `learner_invitation_opened`
- `learner_invitation_accepted`

### Assignment

- `assignment_draft_created`
- `assignment_published`
- `assignment_assigned`
- `assignment_opened_by_learner`

### Submission

- `submission_started`
- `submission_saved`
- `submission_completed`

### AI

- `ai_analysis_requested`
- `ai_analysis_completed`
- `ai_analysis_failed`
- `ai_feedback_viewed`
- `ai_hint_requested`
- `ai_feedback_rated`

### Tutor review

- `tutor_review_opened`
- `tutor_review_confirmed`
- `tutor_review_corrected`
- `tutor_review_rejected`

### Progress and retention

- `learner_progress_viewed`
- `tutor_progress_viewed`
- `next_action_created`

### Reliability

- `client_error_presented`
- `retry_started`
- `demo_reset_completed`

## 6. Event properties

Allowed examples:

- internal pseudonymous user/workspace ID;
- event timestamp;
- subject or task type from an approved enumeration;
- client version;
- latency bucket;
- success/failure code;
- model/prompt version where approved;
- pilot cohort flag.

Disallowed by default:

- full name;
- phone/email;
- raw learner answer;
- full AI prompt or response;
- school name;
- payment data;
- uploaded document contents;
- access tokens.

## 7. Metrics derived from events

Potential metrics:

- invite acceptance rate;
- assignment creation-to-publication rate;
- learner assignment completion rate;
- analysis success and schema-validity rate;
- tutor review and correction rate;
- median feedback latency;
- end-to-end completion rate;
- usefulness rating;
- pilot repeat-use rate.

No metric becomes a public claim without data-quality validation.

## Confirmed local retry behavior — AUD029 (not deployed)

`POST /api/invitations/accept` may be retried by the same authenticated learner who accepted the invitation, while its lifetime remains valid. It returns success without creating another relationship. Another learner, an expired/revoked/declined invitation, or an incompatible role remains rejected. A new preview of a consumed invitation remains rejected. Verified by `test_invitation_retry.py`, the mutation runner and `audit-invite-delivery.spec.ts`; no schema migration or response-format change.
