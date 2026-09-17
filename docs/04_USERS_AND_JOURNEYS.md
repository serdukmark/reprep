# Users and journeys

## 1. Primary personas

These are working personas, not validated demographic claims.

### Tutor

`[CONFIRMED]` An independent tutor who manages learners without an administrative team.

Likely characteristics to validate:

- uses a messenger for communication;
- uses documents, forms or separate services for homework;
- manually checks at least some assignments;
- reconstructs learner context from memory or scattered notes;
- prepares learners for OGE/EGE or another measurable goal;
- values control over teaching approach and materials.

Unknowns:

- subject;
- number of learners;
- current stack;
- frequency and cost of homework checking;
- willingness to pay;
- need for schedule and payment tracking;
- tolerance for AI mistakes.

### Learner

`[CONFIRMED]` A school student working with a private tutor.

Likely characteristics to validate:

- primarily uses a phone;
- needs clear next steps rather than long generic explanations;
- may need help between lessons;
- may be a minor;
- may use generative AI outside the tutor's workflow.

Unknowns:

- age range;
- motivation and study habits;
- device and accessibility needs;
- preference for hints versus full explanations;
- parent/guardian involvement;
- acceptable notification frequency.

### Parent or guardian

`[FUTURE]` May pay, grant consent or request progress visibility. Not a P0 product role unless pilot or legal requirements make it necessary.

## 2. Tutor journey

### Journey T1 — onboarding

1. Tutor opens the product in the approved MAX surface.
2. Tutor understands the product value and role.
3. Tutor creates or accesses a workspace.
4. Tutor selects subject or teaching context.
5. Tutor creates or invites a learner.
6. Tutor reaches a useful next action without mandatory completion of unrelated setup.

Edge cases:

- invalid or expired invite;
- learner already linked;
- duplicate account;
- MAX identity unavailable;
- unsupported subject;
- demo mode without real identity.

### Journey T2 — create and assign work

1. Select learner.
2. Create assignment title and instructions.
3. Add one or more questions/tasks.
4. Specify evaluation reference: answer key, rubric or tutor notes.
5. Tag skills when available.
6. Preview as learner.
7. Assign due date.
8. Publish.

Required safeguards:

- drafts must not appear to learners;
- answer keys must not leak to learner responses;
- unsupported question types must be clear;
- published assignment changes must be tracked or constrained.

### Journey T3 — review AI analysis

1. Tutor receives a submission-ready state.
2. Tutor opens original learner response.
3. Tutor sees AI output separately from the original.
4. Tutor sees rubric, evidence and uncertainty.
5. Tutor confirms, edits or rejects the output.
6. Tutor optionally sends feedback.
7. Confirmed result updates learner progress.

Edge cases:

- AI unavailable;
- response cannot be assessed;
- learner submits empty or malicious content;
- answer is partly correct;
- tutor disagrees with skill classification;
- resubmission after feedback;
- assignment changed after submission.

### Journey T4 — inspect progress

1. Tutor opens learner profile.
2. Tutor sees completed assignments and confirmed evidence.
3. Tutor inspects skill trends and gaps.
4. Tutor chooses a next action.

The interface must distinguish confirmed evidence from AI-proposed or inferred information.

## 3. Learner journey

### Journey L1 — join tutor

1. Learner opens invitation.
2. Learner sees who invited them and the intended relationship.
3. Learner confirms or declines.
4. Any required consent or guardian flow is handled according to the future approved policy.

`[OPEN]` Exact identity and consent workflow.

### Journey L2 — complete assignment

1. Learner sees active assignment, subject and due date.
2. Learner opens instructions and materials.
3. Learner answers supported tasks.
4. Work is autosaved or clearly saved.
5. Learner submits intentionally.
6. System confirms receipt.

Edge cases:

- network interruption;
- accidental exit;
- deadline passed;
- repeated submit;
- unsupported file;
- response too large;
- tutor withdraws assignment.

### Journey L3 — receive help and feedback

1. Learner sees whether feedback is preliminary AI feedback or tutor-approved feedback.
2. Learner receives an explanation connected to the task.
3. Learner may request a hint when enabled.
4. Learner corrects or reflects according to assignment policy.
5. Learner sees the next expected action.

The system must not encourage blind answer copying.

## 4. Administrator or support journey

`[PROPOSED]` A minimal operational role or internal tool may be needed for pilot support, but it must not become a broad admin platform.

Possible needs:

- view service health;
- locate a pilot account with authorized identifiers;
- reset synthetic demo data;
- inspect error IDs without reading unnecessary learner content;
- disable abusive content or compromised access;
- export or delete pilot data when required.

The role, access model and interface are `[OPEN]`.

## 5. Demo journey

The hackathon demo should show one uninterrupted story:

1. tutor assigns a task;
2. learner gives a representative incorrect answer;
3. AI explains the error and proposes a gap;
4. tutor reviews and confirms/corrects it;
5. learner progress changes;
6. evidence from the pilot is shown.

Avoid touring unrelated screens.
