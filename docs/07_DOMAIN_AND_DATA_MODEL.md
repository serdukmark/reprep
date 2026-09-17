# Domain and data model

This document is conceptual. It does not prescribe SQL, ORM or vendor choices.

## 1. Modeling principles

1. Preserve original learner work separately from generated or edited content.
2. Preserve the relationship between every progress claim and supporting evidence.
3. Distinguish AI proposals from tutor-confirmed decisions.
4. Scope authorization by workspace and relationship, not by client-provided IDs alone.
5. Version content that affects assessment.
6. Minimize personal data.
7. Keep external provider identifiers out of core domain meaning where possible.

## 2. Proposed entities

### User

Represents a product identity.

Possible fields:

- internal ID;
- external MAX identity reference, if approved;
- status;
- created/updated timestamps;
- last-access metadata with privacy limits.

Open questions:

- one or multiple authentication methods;
- whether a user can have multiple roles;
- account deletion and recovery behavior.

### TutorProfile

Possible fields:

- user ID;
- display name;
- subject metadata;
- onboarding state;
- settings;
- pilot/support flags.

Avoid collecting unnecessary professional or personal details.

### LearnerProfile

Possible fields:

- user ID or invited/pending identity;
- display name or alias;
- level/year represented only if necessary;
- settings and consent state;
- accessibility preferences when explicitly provided and safely handled.

Do not infer age, diagnosis or protected traits.

### TutorLearnerRelationship

Represents authorization and teaching context.

Possible fields:

- tutor ID;
- learner ID;
- subject/program ID;
- state: invited, active, paused, ended;
- invitation metadata;
- relationship start/end;
- feedback policy.

### Subject

Examples could include Mathematics or Russian Language, but the initial subject is `[OPEN]`.

### Skill

Represents a versioned element of a tutor-approved skill taxonomy.

Possible fields:

- skill ID;
- subject/program;
- parent skill;
- title and description;
- taxonomy version;
- active state.

### Material

Tutor-provided learning reference.

Possible fields:

- owner tutor;
- title;
- link or stored-object reference;
- type;
- access scope;
- AI-use permission state;
- copyright/source note;
- processing status.

### Assignment

Possible fields:

- tutor and relationship IDs;
- title/instructions;
- status: draft, published, archived;
- version;
- due date or no-deadline state;
- published timestamp;
- feedback release policy;
- created/updated timestamps.

### AssignmentTask

Possible fields:

- assignment/version ID;
- position;
- task type;
- learner-visible prompt;
- tutor-only evaluation reference;
- skill tags;
- points or weight if used;
- AI assessment policy.

### Submission

Represents a learner's attempt for an assignment version.

Possible fields:

- assignment version;
- learner;
- attempt number;
- state: in_progress, submitted, analyzing, reviewed, returned;
- submitted timestamp;
- original content checksum/version;
- deadline context.

### SubmissionAnswer

Possible fields:

- submission;
- task;
- original answer data;
- attachment references;
- saved/submitted timestamps.

Original submitted answer must not be overwritten by AI feedback or tutor edits.

### AIAnalysis

Possible fields:

- submission/task;
- status;
- structured output;
- provider-neutral model reference;
- prompt version;
- schema version;
- context version/hash;
- latency, retry and cost metadata when allowed;
- created timestamp;
- safety flags.

Avoid storing raw prompts containing unnecessary personal data.

### TutorReview

Possible fields:

- target AI analysis;
- reviewer tutor;
- action: confirmed, corrected, rejected;
- corrected assessment/feedback;
- notes;
- timestamp.

### SkillEvidence

Links a learner skill state to a specific task result.

Possible fields:

- learner/relationship;
- skill and taxonomy version;
- source submission/task;
- evidence type;
- proposed/confirmed state;
- strength or score if defined;
- tutor review reference;
- timestamp.

### ProgressSnapshot

Optional derived view for performance, not the sole source of truth.

Must be reproducible from evidence or clearly versioned.

### LessonEvent `[P1]`

Possible fields:

- tutor/learner relationship;
- start/end time and timezone;
- status;
- reminder state;
- optional assignment/material links.

### PaymentStatusRecord `[P1]`

Non-financial personal record only.

Possible fields:

- relationship or lesson;
- period/reference;
- status: unpaid, paid, waived, unknown;
- note;
- timestamp.

Do not store card or bank details.

### FeedbackReport `[P1]`

Possible fields:

- reporter;
- context entity;
- category;
- usefulness rating;
- text;
- operational status.

### AuditEvent

Records security- or pedagogy-relevant state changes without copying unnecessary content.

## 3. Lifecycle rules

### Assignment versioning

`[PROPOSED]` A published assignment version should remain stable for existing submissions. Material corrections after publication should create a new version or an explicit amendment.

Exact versioning UI is `[OPEN]`.

### Submission immutability

After final submit, original learner content should be immutable from normal UI. Resubmission creates a new attempt or version.

### AI result lifecycle

Suggested states:

1. queued;
2. processing;
3. valid;
4. invalid_output;
5. failed_retryable;
6. failed_final;
7. tutor_confirmed;
8. tutor_corrected;
9. tutor_rejected.

### Relationship end

`[OPEN]` Decide data visibility and retention after a tutor-learner relationship ends.

### Deletion

`[OPEN][EXTERNAL CONFIRMATION REQUIRED]` Define deletion, retention and legal requirements.

Architecture should support:

- account deletion request;
- relationship data export where appropriate;
- removal or anonymization of pilot data;
- deletion of uploaded content and provider-side artifacts if applicable.

## 4. Multi-tenancy

`[PROPOSED]` Treat each tutor as an isolated workspace for the first release.

All queries involving tutor-owned data must enforce workspace authorization server-side.

`[FUTURE]` Organizations or multiple tutors per workspace require a separate authorization design.

## 5. Data classification

### Public

- public product copy;
- non-sensitive subject taxonomy.

### Internal

- synthetic fixtures;
- non-sensitive operational configuration;
- aggregate product metrics.

### Confidential

- tutor account details;
- learner work;
- feedback;
- learning history;
- uploaded materials;
- invitations and relationship data.

### Secret

- provider tokens;
- signing secrets;
- database credentials;
- session keys.

Secret data must never be stored in the repository or client bundle.
