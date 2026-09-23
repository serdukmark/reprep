# UX and UI requirements

## 1. Experience principles

1. **One obvious next action.** Each primary screen should make the next step clear.
2. **Mobile first.** The primary surface is expected to be a MAX-based mobile experience, subject to platform confirmation.
3. **Human control is visible.** AI and tutor-approved content must not be visually conflated.
4. **No silent loss.** Drafts, submissions and errors need explicit state.
5. **Learning before gamification.** Avoid decorative mechanics that distract from correction and progress.
6. **Safe language.** Do not shame, diagnose or make absolute claims about learner ability.
7. **Progress has evidence.** Users should be able to understand what generated a progress change.
8. **Accessible defaults.** Legible type, adequate contrast, large touch targets and non-color-only status indicators.

## 2. Navigation proposal

Exact information architecture is `[PROPOSED]`.

### Tutor primary areas

- Today / dashboard;
- Learners;
- Assignments;
- Materials `[P1]`;
- Schedule `[P1]`;
- Settings/help.

### Learner primary areas

- Today / active work;
- Assignments;
- Progress;
- Materials `[P1]`;
- Settings/help.

Avoid showing navigation items that lead only to empty placeholders in the pilot build.

## 3. Required screens and states

### Tutor onboarding

Content:

- clear product purpose;
- role confirmation;
- subject/teaching context if needed;
- add/invite learner CTA;
- skip or demo path where appropriate.

States:

- fresh account;
- resumed incomplete onboarding;
- identity error;
- unsupported platform state.

### Tutor dashboard

Should prioritize:

- work awaiting review;
- upcoming lessons or due assignments if implemented;
- learner requiring attention;
- create assignment action.

Do not make vanity statistics the primary content.

### Learner list and profile

- display name/alias;
- subject/program;
- active assignments;
- recent confirmed progress;
- proposed gaps clearly distinguished from confirmed gaps;
- invite state;
- relationship actions according to authorization.

### Assignment builder

Required:

- draft state;
- title and instructions;
- task editor;
- answer key/rubric separated from learner-visible text;
- skill tags where used;
- deadline;
- preview;
- validation before publish.

Warnings:

- explain when a task type cannot be reliably AI-assessed;
- prevent accidental publication of answer keys;
- communicate effect of editing a published assignment.

### Learner assignment

Required:

- title, instructions and deadline;
- task progress;
- autosave/saved indicator;
- clear submit action;
- confirmation before irreversible submit if appropriate;
- retry and offline/network failure messaging.

### AI feedback

Visually label:

- preliminary AI feedback;
- tutor-approved feedback;
- tutor correction;
- cannot-assess/manual-review state.

Include:

- what was observed;
- what to correct;
- a hint or next step;
- clear separation from final answer when hint-first behavior applies;
- report/wrong-feedback action `[P1]`.

### Tutor review

Show side by side or in a clear sequence:

- task and rubric;
- original learner answer;
- AI assessment and evidence;
- uncertainty/safety flags;
- confirm/edit/reject actions;
- effect on learner progress.

### Progress

- avoid a single unexplained “AI score”;
- show skills with evidence and time context;
- indicate confirmation state;
- avoid harmful comparisons with other learners;
- do not imply exam outcome prediction unless separately validated.

## 4. Empty states

Every major list requires an empty state with a useful next action.

Examples:

- no learners → invite or use demo learner;
- no assignments → create assignment;
- no submissions → explain that assigned work has not been submitted;
- no confirmed progress → explain that progress appears after reviewed work;
- AI unavailable → preserve submission and offer manual review/retry.

## 5. Error-state requirements

Errors should state:

- what happened in plain language;
- whether data was saved;
- what the user can do;
- safe reference ID for support.

Do not expose provider, stack trace or secret details.

## 6. Copy rules

- prefer “AI suggestion” or “preliminary analysis” over “AI verdict”;
- prefer “needs tutor review” over “wrong”; 
- prefer specific actions over generic “Something went wrong”;
- never say a learner is incapable or has a disorder;
- do not promise guaranteed score improvement;
- distinguish “paid status recorded by tutor” from “payment processed”.

## 7. Visual direction

`[PROPOSED]` Product visuals may align with the MAX environment while retaining a distinct reprep identity.

Open decisions:

- brand colors and logo;
- official MAX design-system requirements;
- dark/light mode;
- illustration style;
- typography and icon set.

Do not imitate protected official assets beyond permitted platform guidelines.

## 8. Accessibility baseline

- adequate color contrast;
- touch targets appropriate for mobile;
- focus order and keyboard behavior for web environments;
- meaningful labels for controls;
- status conveyed by text/icon, not color alone;
- reduced-motion respect where motion exists;
- error text associated with fields;
- readable layout at text zoom;
- no essential information only in images.

Exact compliance target is `[OPEN]`, but basic accessibility is required.

## 9. Demo mode

The demo must:

- clearly use synthetic data;
- start from a known state;
- have a deterministic reset procedure;
- avoid dependency on an unpredictable live AI answer for the only demonstration path;
- still demonstrate the real AI integration honestly;
- provide a backup recording if external services fail.

## Registration role selection — 2026-09-23

[CONFIRMED] По просьбе владельца нативный выпадающий список заменён тремя карточками ролей. Иконка, короткое пояснение и галочка выбранной роли; нажатие по всей карточке. Семантика fieldset/legend и native radio сохраняет клавиатурный выбор и доступность. Выбор блокируется на время отправки формы. Проверка: npm run build; после выкатки открыть регистрацию в Telegram или MAX. Правила назначения роли и серверные права не менялись.
