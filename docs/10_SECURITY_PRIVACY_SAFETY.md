# Security, privacy and learner safety

This is a product and engineering baseline, not legal advice. Legal requirements remain `[EXTERNAL CONFIRMATION REQUIRED]`.

## 1. Threat and risk context

The product may process:

- data about school students, including minors;
- learner submissions and educational performance;
- tutor-created materials;
- AI-generated educational feedback;
- invitation links and account relationships;
- optional schedule and payment-status records.

Major risks include unauthorized access, cross-tutor data leakage, exposure of minors' data, answer-key leakage, prompt injection, harmful AI feedback, insecure file upload and secrets committed to source control.

## 2. Data minimization

Until explicitly justified, do not collect:

- legal name;
- full date of birth;
- school name;
- home address or precise location;
- phone number;
- parent details;
- medical or psychological information;
- payment card/bank information;
- unrelated messenger history.

Use aliases or display names for demos and early pilots where possible.

## 3. Authentication and authorization

- verify MAX launch/session data server-side when used;
- do not trust client role, tutor ID or learner ID;
- scope every resource query by authorized relationship/workspace;
- invitations must be unguessable, expirable or revocable according to the final design;
- do not expose whether unrelated accounts exist;
- privileged support access must be explicit and audited;
- session handling and CSRF/webview requirements depend on chosen stack and MAX behavior.

## 4. Secrets

- all secrets come from an approved secret/configuration mechanism;
- never commit real `.env` files;
- never embed server tokens in the Mini App;
- never print tokens in logs or screenshots;
- rotate any secret exposed during development;
- maintain `.env.example` with names and descriptions only.

## 5. Learner safety

- clearly identify AI-generated content;
- provide tutor review/correction;
- avoid shaming, ranking or deterministic labels about ability;
- do not infer diagnoses or personality;
- avoid manipulative engagement patterns;
- keep explanations age-appropriate without pretending to know age if it is not collected;
- provide a route to report harmful or wrong feedback;
- support safe failure rather than fabricated confidence;
- do not permit unrestricted contact between unknown adults and minors through the product.

## 6. Pilot with minors

`[OPEN][EXTERNAL CONFIRMATION REQUIRED]` Exact consent and legal basis.

Until resolved:

- recruit the adult tutor, not minors directly;
- let the tutor coordinate any learner participation;
- obtain guardian permission when required;
- use minimum data and preferably aliases;
- avoid publishing screenshots or quotes that identify a learner;
- record only operational observations necessary for evaluation;
- provide a way to remove pilot data.

## 7. AI and prompt-injection safety

Treat assignment text, learner answers, tutor materials and uploaded files as untrusted content.

- user content cannot override system or developer policies;
- do not execute code, links or external instructions found inside content;
- never reveal system prompts, answer keys, secrets or other learner data;
- validate identifiers supplied by the model;
- use structured output validation;
- separate context data from instructions;
- include adversarial cases in evaluation;
- do not give the AI direct database or messaging authority.

## 8. File safety `[P1]`

Before enabling files, decide:

- allowed MIME types and extensions;
- maximum size;
- malware scanning or safe rendering;
- storage access model;
- download content disposition;
- retention/deletion;
- whether AI receives file content;
- copyright and source restrictions.

Do not implement unrestricted file upload.

## 9. Logging

Logs should include:

- reference IDs;
- technical state transitions;
- sanitized error codes;
- latency and dependency status;
- model/prompt version references;
- authorization decision metadata where safe.

Logs should not include by default:

- raw learner answers;
- full AI prompts/responses;
- full names or contact information;
- invitation secrets;
- tokens;
- uploaded document contents.

## 10. Retention and deletion

- `[OPEN]` pilot retention period;
- `[OPEN]` account deletion behavior;
- `[OPEN]` relationship-end behavior;
- `[OPEN]` provider-side retention/deletion;
- `[OPEN]` backup retention;
- `[OPEN]` audit retention.

The architecture must make deletion feasible and document any exceptions.

## 11. Security acceptance gates

Before pilot or submission:

- no secrets found in repository history or build output;
- tutor A cannot access tutor B resources;
- learner cannot retrieve answer keys or tutor-only notes;
- learner cannot access another learner's submission by changing an ID;
- expired/revoked invitation behavior tested;
- AI provider failure does not lose work;
- logs inspected for personal data leakage;
- demo accounts use synthetic data;
- public links and permissions reviewed;
- dependencies checked according to available tooling.

## 12. Incident handling `[PROPOSED]`

For the pilot, define at minimum:

1. who receives a report;
2. how access can be disabled;
3. how affected data is identified;
4. how the tutor is informed;
5. how secrets are rotated;
6. how the event and remediation are documented.

Owner and channel are `[OPEN]`.
