# AI system specification

## 1. Purpose

AI assists with learning feedback and tutor workflow. It does not replace tutor authority or independently establish high-stakes grades.

## 2. AI capabilities in scope

### AI-USE-001 — analyze a learner answer `[P0]`

Inputs may include:

- task text;
- learner answer;
- answer key or rubric;
- tutor instruction;
- skill tags;
- narrowly selected learner history relevant to the task.

Output must be structured and auditable.

### AI-USE-002 — explain an error `[P0]`

Produce a concise explanation appropriate to the learner context without claiming certainty beyond available evidence.

### AI-USE-003 — provide a hint `[P0]`

Provide a next-step hint that supports learning rather than immediately disclosing the final answer, unless the tutor policy or task explicitly allows a full solution.

### AI-USE-004 — propose skill gaps `[P0]`

Propose skill-gap candidates tied to specific evidence. Durable progress must preserve the evidence and confirmation state.

### AI-USE-005 — propose next action `[P1]`

Recommend a topic or task for tutor consideration. The recommendation must not auto-assign without approved behavior.

### AI-USE-006 — assignment-bound Q&A `[P1]`

Learner may ask a question limited to the assignment and approved context.

Unrestricted general chat is not P0.

## 3. Explicit non-capabilities

AI must not:

- make medical, psychological or disability diagnoses;
- infer protected characteristics;
- decide disciplinary or high-stakes educational outcomes;
- fabricate learner history or tutor materials;
- claim that a learner has mastered a skill without evidence;
- reveal answer keys or hidden tutor notes;
- expose another learner's data;
- contact users autonomously;
- create legal or payment commitments;
- silently convert a low-confidence inference into confirmed progress.

## 4. Context policy

### Allowed context categories

Subject to privacy approval:

- current task and rubric;
- current learner response;
- tutor-approved skill taxonomy;
- relevant confirmed prior evidence;
- learner level represented in a non-sensitive form;
- approved tutor material excerpts.

### Excluded by default

- full message history unrelated to the task;
- names and direct identifiers when not necessary;
- phone numbers, school names and precise location;
- other learners' work;
- unapproved files;
- payment information;
- hidden system credentials;
- unsupported inferred traits.

## 5. Proposed structured output

The exact schema is `[PROPOSED]` and must be versioned.

```json
{
  "schema_version": "1",
  "assessment_status": "assessed | partially_assessed | cannot_assess",
  "correctness": "correct | incorrect | partially_correct | unknown",
  "confidence": 0.0,
  "summary_for_tutor": "string",
  "feedback_for_learner": "string",
  "hint": "string | null",
  "evidence": [
    {
      "criterion_id": "string",
      "observation": "string"
    }
  ],
  "skill_gap_candidates": [
    {
      "skill_id": "string",
      "reason": "string",
      "confidence": 0.0
    }
  ],
  "safety_flags": ["string"],
  "requires_tutor_review": true
}
```

Rules:

- validate types and enumerations;
- reject extra fields if they create unsafe ambiguity;
- do not trust model-supplied identifiers without checking them against authorized context;
- confidence is model-reported or system-derived and must not be presented as mathematically calibrated unless evaluated;
- store model and prompt version separately from user-visible content.

## 6. Processing lifecycle

1. Preserve original submission.
2. Authorize access.
3. Select minimal context.
4. Redact disallowed fields where applicable.
5. Create provider-neutral request.
6. Call provider through an adapter.
7. Validate structured response.
8. Run deterministic post-processing and safety checks.
9. Persist result with status and versions.
10. Present according to feedback-release policy.
11. Receive tutor confirmation/correction.
12. Update progress from the confirmed result.

## 7. Failure behavior

### Provider timeout or error

- submission remains saved;
- status becomes retryable or manual-review required;
- learner receives a neutral status, not a fabricated result;
- tutor can review manually;
- retries use limits and idempotency.

### Invalid structured output

- do not partially trust malformed content;
- retry with bounded policy or route to manual review;
- log schema failure without unnecessary personal content.

### Cannot assess

- show why, when safe and useful;
- request a better response or tutor input;
- do not create a negative skill event solely from missing or unreadable data.

### Unsafe or malicious input

- preserve necessary evidence according to policy;
- prevent prompt content from overriding system rules;
- avoid executing links or instructions supplied inside learner content;
- flag for tutor or support review when appropriate.

## 8. Tutor-in-the-loop policy

`[CONFIRMED]` Tutor must be able to review and correct AI output.

`[OPEN]` Decide which output can be shown immediately to the learner before tutor approval.

Possible policies:

- **Immediate preliminary feedback:** fast but requires very strong safety and clear labelling.
- **Tutor approval first:** safer but slower.
- **Configurable hybrid:** hints immediately; grades/gaps after approval.

Do not implement one as permanent without a recorded decision.

## 9. Prompt management

- keep prompts versioned;
- treat prompts as code;
- document expected input fields;
- do not place secrets in prompts;
- separate provider-specific formatting from pedagogical policy;
- add regression fixtures for every prompt change;
- record prompt version with result;
- avoid using real learner content in test snapshots.

## 10. Evaluation

Maintain an evaluation set containing, where applicable:

- clearly correct responses;
- clearly incorrect responses;
- partially correct responses;
- alternative valid wording;
- missing answers;
- ambiguous tasks;
- irrelevant or adversarial content;
- prompt-injection attempts;
- unsupported file/content formats;
- cases where the rubric is insufficient;
- prior context that should and should not matter.

### Metrics to consider

- agreement with tutor ground truth;
- false-positive and false-negative rates where meaningful;
- rate of `cannot_assess`;
- schema validity rate;
- tutor edit/reject rate;
- explanation usefulness rating;
- latency and failure rate;
- cost per analysis;
- leakage or safety incident count.

Exact thresholds are `[OPEN]` until the subject, model and evaluation set are selected.

## 11. Provider and model

- `[OPEN]` AI provider;
- `[OPEN]` model;
- `[OPEN]` embedding or retrieval provider;
- `[OPEN]` data-retention terms;
- `[OPEN]` regional processing constraints;
- `[OPEN]` cost and rate limits.

Core product logic must depend on an internal AI interface, not a provider SDK directly.
