# Open questions register

Coding agents must not silently resolve these questions. Add owner, answer, source and date when resolved, then update affected documents and `16_DECISION_LOG.md`.

## 1. Hackathon and case fit

| ID | Question | Status / authority needed | Blocks |
|---|---|---|---|
| OQ-HACK-001 | Are independent tutors and their school learners accepted as a product “for schools or universities”? | Organizer confirmation required | Final positioning and eligibility |
| OQ-HACK-002 | Must the product address skills, career navigation and safe environment together, or may it focus on one? | Organizer confirmation required | Scope and presentation |
| OQ-HACK-003 | Is a MAX Mini App required, or is a bot sufficient/required? | Official case/MAX rules | Client architecture |
| OQ-HACK-004 | What exact criteria and weights will judges use? | Official case | Prioritization and final checklist |
| OQ-HACK-005 | What artifacts must be submitted? | Submission form | Release package |
| OQ-HACK-006 | What is the exact deadline time on 30 September? | Organizer | Submission operations |
| OQ-HACK-007 | Is Docker mandatory for this case? | Organizer/technical rules | Infrastructure |
| OQ-HACK-008 | Are repository visibility or license rules specified? | Official rules | Repository setup |
| OQ-HACK-009 | Are there slide, video or presentation timing limits? | Organizer | Presentation |
| OQ-HACK-010 | Are third-party AI providers and external hosting allowed? | Official rules | Architecture |

## 2. MAX platform

| ID | Question | Owner/source needed | Blocks |
|---|---|---|---|
| OQ-MAX-001 | How is Mini App launch data verified server-side? | MAX technical docs | Authentication |
| OQ-MAX-002 | What user attributes are available and permitted? | MAX technical docs | Profile model |
| OQ-MAX-003 | What bot notification APIs, permissions and rate limits exist? | MAX technical docs | Reminders |
| OQ-MAX-004 | How are deep links and invitations implemented? | MAX technical docs | Invitations |
| OQ-MAX-005 | What webview/storage/network restrictions apply? | MAX technical docs | Client implementation |
| OQ-MAX-006 | Is there a sandbox/test environment? | MAX technical docs | Testing |
| OQ-MAX-007 | Is any review or publication step required before evaluators can open the app? | MAX/organizer | Deployment schedule |
| OQ-MAX-008 | Which official design-system requirements apply? | MAX design docs | UI |

## 3. Product and pilot

| ID | Question | Decision owner | Blocks |
|---|---|---|---|
| OQ-PROD-001 | Which subject is used for the first pilot and demo? | Product owner + tutor | Task types and AI evaluation |
| OQ-PROD-002 | Who is the first adult pilot tutor? | Product owner | Pilot |
| OQ-PROD-003 | How many learners participate, and are they minors? | Tutor/product owner | Consent and pilot operations |
| OQ-PROD-004 | Which assignment types are P0? | Product + engineering after subject choice | UI/data/AI |
| OQ-PROD-005 | Can a user hold both tutor and learner roles? | Product owner | Identity model |
| OQ-PROD-006 | Are learners shown AI feedback immediately or after tutor approval? | Product + safety owner | AI flow and UX |
| OQ-PROD-007 | What is the retry/resubmission policy? | Product owner | Submission lifecycle |
| OQ-PROD-008 | How are published assignment edits handled? | Product + engineering | Versioning |
| OQ-PROD-009 | Is schedule required for the hackathon MVP or only the pilot? | Product owner | P1 plan |
| OQ-PROD-010 | Is manual payment status included in the submitted build? | Product owner | P1 plan |
| OQ-PROD-011 | Which features are required for the first client's continued use after the hackathon? | Pilot tutor | Roadmap |

## 4. AI

| ID | Question | Authority needed | Blocks |
|---|---|---|---|
| OQ-AI-001 | Which AI provider and model are selected? | Engineering/product | Adapter implementation |
| OQ-AI-002 | Are provider data use/retention terms acceptable for learner content? | Product/privacy review | Real data processing |
| OQ-AI-003 | Is data processed in an acceptable region? | Privacy/legal review | Real data processing |
| OQ-AI-004 | What cost and rate limits apply? | Engineering/product | Usage controls |
| OQ-AI-005 | What accuracy threshold is acceptable for the chosen subject/task types? | Tutor/product | Release gate |
| OQ-AI-006 | Who creates and approves the evaluation ground truth? | Product/pilot tutor | AI evaluation |
| OQ-AI-007 | Are embeddings/RAG needed for P0? | Engineering/product | Architecture |
| OQ-AI-008 | May tutor materials be sent to/indexed by the provider? | Tutor + privacy/copyright review | Materials AI |
| OQ-AI-009 | Is confidence model-reported, rule-based or calibrated? | Engineering | UI/schema |
| OQ-AI-010 | What exact content categories require moderation or blocking? | Safety/product | AI and reporting |

## 5. Privacy, consent and legal

| ID | Question | Authority needed | Blocks |
|---|---|---|---|
| OQ-PRIV-001 | What legal basis applies to tutor and learner data? | Legal/privacy owner | Production pilot |
| OQ-PRIV-002 | What guardian consent is required for minors? | Legal/privacy owner | Minor pilot participation |
| OQ-PRIV-003 | Which minimum profile fields are allowed/needed? | Product/privacy | Data model |
| OQ-PRIV-004 | What retention period applies to pilot data? | Product/privacy | Data lifecycle |
| OQ-PRIV-005 | What deletion/export process is required? | Product/privacy | Account lifecycle |
| OQ-PRIV-006 | May anonymized quotes/metrics be used publicly, and what permission is needed? | Pilot participant/privacy | Presentation |
| OQ-PRIV-007 | What policy applies to tutor-provided copyrighted materials? | Tutor/legal review | Materials |
| OQ-PRIV-008 | What incident response contacts and obligations apply? | Project owner | Pilot readiness |

## 6. Engineering stack

| ID | Question | Decision owner | Blocks |
|---|---|---|---|
| OQ-TECH-001 | Frontend framework/language? | Engineering | Repository scaffold |
| OQ-TECH-002 | Backend framework/language? | Engineering | Repository scaffold |
| OQ-TECH-003 | Database/provider and migration tool? | Engineering | Persistence |
| OQ-TECH-004 | Hosting and deployment platform? | Engineering | Shared environment |
| OQ-TECH-005 | File storage provider? | Engineering | Uploads |
| OQ-TECH-006 | Background job/queue mechanism? | Engineering | AI/reminders |
| OQ-TECH-007 | Analytics and error monitoring? | Engineering/product | Pilot observability |
| OQ-TECH-008 | CI/CD provider and branching strategy? | Engineering | Team workflow |
| OQ-TECH-009 | Monorepo or separate repositories? | Engineering | Repo structure |
| OQ-TECH-010 | Staging and production separation? | Engineering | Deployment |

## 7. Business

| ID | Question | Decision owner | Blocks |
|---|---|---|---|
| OQ-BIZ-001 | Who is the initial payer? | Product/research | Pricing |
| OQ-BIZ-002 | Subscription price and usage limits? | Product/research | Business slide |
| OQ-BIZ-003 | Is there a free trial/tier? | Product | Onboarding/business |
| OQ-BIZ-004 | What is acceptable AI cost per active learner? | Product/engineering | Unit economics |
| OQ-BIZ-005 | What is the first acquisition channel? | Product/research | Go-to-market |
| OQ-BIZ-006 | What evidence supports market-size claims? | Product | Presentation |

## Resolution format

When answering an item, record:

- answer;
- date;
- decision owner;
- authoritative source/link/file;
- consequences;
- documents/code requiring change;
- new risks or follow-up questions.
