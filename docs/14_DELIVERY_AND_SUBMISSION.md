# Delivery, release and hackathon submission

## 1. Known organizer expectations

Based on the analyzed organizer webinar:

- `[CONFIRMED]` build a working prototype appropriate to the case;
- `[CONFIRMED]` prepare a presentation and full materials;
- `[CONFIRMED]` use case criteria as a checklist;
- `[CONFIRMED]` keep README current;
- `[CONFIRMED]` ensure another person can start/check the solution;
- `[CONFIRMED]` do not commit secrets;
- `[CONFIRMED]` verify links and access;
- `[CONFIRMED]` first-stage deadline was announced as 30 September;
- `[OPEN]` exact deadline time;
- `[OPEN]` official artifact list;
- `[OPEN]` repository visibility/hosting rules;
- `[OPEN]` whether Docker is mandatory;
- `[OPEN]` presentation duration and slide limit;
- `[OPEN]` whether a video is mandatory.

The official case and submission form override this section.

## 2. Recommended release package

Prepare even if not all items are mandatory:

- repository at a permitted visibility level;
- current root README;
- architecture overview;
- `.env.example` without secrets;
- dependency lockfiles;
- migration and seed instructions;
- Docker or equivalent reproducible setup;
- public or evaluator-accessible deployment;
- synthetic demo accounts/instructions;
- presentation;
- appendix;
- short backup demo video;
- pilot evidence summary;
- known limitations;
- contact/support channel permitted by rules.

## 3. Suggested presentation structure

1. **Name and one-liner** — what reprep is.
2. **Problem** — current tutor/learner workflow.
3. **Evidence** — interviews, observed behavior and market context.
4. **Target user and job** — who and what job.
5. **AS IS / TO BE** — what changes.
6. **Live demo** — one uninterrupted core flow.
7. **Why AI is necessary** — bounded learner context, not generic chat.
8. **Safety and human control** — tutor review and minor data principles.
9. **Pilot evidence** — what was actually tested.
10. **Architecture and reproducibility** — why it can work beyond slides.
11. **Business and scale** — subscription direction and future scope.
12. **Team and roadmap** — ability to deliver and next steps.

Adjust to official timing and slide limits once known.

## 4. Demo script

Use a stable synthetic learner and task.

1. Tutor opens learner profile.
2. Tutor creates or opens prepared assignment.
3. Tutor assigns it.
4. Learner opens and submits a representative wrong answer.
5. AI returns structured feedback.
6. Tutor reviews and corrects/confirms it.
7. Progress updates with evidence.
8. Team connects the demo to measured pilot evidence.

Do not spend demo time touring inactive modules.

## 5. Evidence language

Use:

- “In our pilot with one tutor…”
- “We observed…”
- “The tutor reported…”
- “Our current hypothesis is…”
- “This limitation remains…”

Avoid:

- “All tutors need…”
- “AI improves grades…” without evidence;
- “The product is safe” as an absolute claim;
- invented market or pilot numbers;
- claiming payment processing when only status tracking exists.

## 6. Release stages

### Development

- incomplete work behind flags;
- frequent integration;
- synthetic data only by default.

### Pilot candidate

- security and data approach reviewed;
- support procedure established;
- P0 end-to-end passes;
- cleanup/deletion procedure documented.

### Feature freeze

`[PROPOSED]` No new features after 28 September. Only critical fixes, documentation and presentation corrections.

### Submission candidate

- clean-environment test passes;
- demo reset verified;
- public links checked;
- presentation and video complete;
- claims traced to evidence;
- official checklist completed.

## 7. Daily integration rule

Suggested team rhythm:

- morning: outcome, owner and blocker review;
- midday: frontend/backend integration;
- evening: deploy to shared environment;
- product owner runs P0 scenario;
- issues and next-day decisions recorded.

## 8. Final submission checklist

### Official requirements

- [ ] Exact case criteria copied into repository.
- [ ] Exact submission form fields recorded.
- [ ] Exact deadline time confirmed.
- [ ] Required repository/deployment visibility confirmed.
- [ ] Docker requirement confirmed.
- [ ] Slide/video limits confirmed.

### Product

- [ ] P0 flow passes.
- [ ] AI failure path passes.
- [ ] Tutor review/correction works.
- [ ] No answer-key leakage.
- [ ] Demo reset works.
- [ ] Pilot data separated from demo.

### Engineering

- [ ] README matches current commands.
- [ ] Clean environment verified.
- [ ] Migrations and seed verified.
- [ ] Tests pass.
- [ ] Secrets review complete.
- [ ] Logs do not leak personal data.
- [ ] Release tagged.

### Materials

- [ ] Presentation final.
- [ ] Appendix final.
- [ ] Demo video available.
- [ ] Pilot evidence anonymized/approved.
- [ ] Known limitations listed.
- [ ] All links and permissions checked from a separate account.

### Operational

- [ ] Deployment monitored.
- [ ] Backup/rollback procedure known.
- [ ] Team knows who handles incidents.
- [ ] Submission confirmation saved.
