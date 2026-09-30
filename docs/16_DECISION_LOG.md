# Decision log

## D-JOURNEY-001 — Локальная механика нового оформления, 2026-09-30

[CONFIRMED scope / ASSUMPTION rules v1] По поручению владельца через Jarvis:
серверная серия первых сдач в срок, реальная недельная сводка, «Мой путь» из
графа преподавателя и подтверждённых evidence, прогресс заполнения и момент
отправки. Правила — [ADR-014](adr/014-learning-journey.md). Флаг выключен по
умолчанию, миграций нет. Только ветка `design/duolingo` от `f66cf6f`, без push и
выкатки. Стенд, архив, design-mockup, style.css и базовое оформление не трогаем.
Предложение макета о серии сохраняется как история, v1 заменяет его для этой
обратимой реализации. Требования: FR-PROG-006/007, FR-SUB-002/003.

This is a compact project-level log. Material engineering decisions should also have a detailed ADR.

## Confirmed decisions

| ID | Decision | Rationale | Consequences |
|---|---|---|---|
| D-001 | Primary business user is an independent tutor working without an administrative team. | Team-defined product direction. | Optimize workflows for one tutor, not school administration. |
| D-002 | Primary learner is a school student, initially associated with OGE/EGE preparation. | Team-defined target audience. | Minor-data and mobile UX considerations are mandatory. |
| D-003 | Core differentiator is learner-contextual AI embedded in the learning workflow. | Product concept. | Generic chat alone does not satisfy the product vision. |
| D-004 | Core flow is assignment → submission → AI analysis → explanation → tutor review → progress update. | Smallest coherent proof of value. | P0 work must protect this flow. |
| D-005 | Tutor remains able to review and correct AI output. | Pedagogical control and safety. | AI results require review states and auditability. |
| D-006 | Marketplace and real payment processing are outside the hackathon scope. | Delivery focus. | Show only as future roadmap. |
| D-007 | The team aims to run a real pilot with at least one adult tutor before submission. | Stronger evidence than a synthetic demo alone. | Pilot, privacy and support work are first-class deliverables. |
| D-008 | Unknowns are marked rather than silently invented. | Reliability for human and agent contributors. | Open-question register is mandatory. |
| D-009 | Current team: Дмитрий Ярочкин — CAIO; Иван Курбан — CTO; Марк Сердюк — CPO. | Explicit owner confirmation, 2026-09-28. | Supersedes team names in old roadmap cards; see ADR-001. |
| D-010 | Full platform combines scheduling, homework, materials, payments, communication and progress, with AI embedded in the context of each learner. | Owner-approved concept, 2026-09-28. | Canonical description: `22_PROJECT_PASSPORT_RU.md`; first-release priorities remain distinct. |
| D-011 | Business model: subscriptions for tutors and learners, followed by commissions for tutor matching and payments through the platform. | Explicit owner confirmation, 2026-09-28. | Replaces proposed-only monetization labels. Prices, rollout, usage limits and commission rates remain open; D-006 still applies to the hackathon. |
| D-012 | A more affordable standalone AI tutor is part of the confirmed product vision. | Explicit owner confirmation, 2026-09-28. | Does not change tutor-led P0 or assert availability. Standalone pedagogy, safety and release policy require specification under OQ-PROD-012. |

## Proposed decisions pending confirmation

| ID | Proposal | Why proposed | Confirmation needed |
|---|---|---|---|
| P-001 | Use a MAX Mini App as the main surface and a bot only for reminders/deep links. | LMS workflow needs structured screens. | Official case/MAX platform confirmation. |
| P-002 | Use one subject and a narrow task set for the pilot. | Enables reliable AI evaluation. | Product owner and pilot tutor. |
| P-003 | Treat each tutor as an isolated workspace. | Simplifies authorization and pilot model. | Engineering review. |
| P-004 | Use a modular monolith rather than microservices. | Speed and operational simplicity. | Stack/architecture decision. |
| P-005 | Preserve original submissions and create new attempts for resubmission. | Auditability and data integrity. | Product policy. |
| P-006 | Use structured AI output and provider adapters. | Safety and replaceability. | Engineering approval/provider selection. |
| P-007 | Freeze new features on 28 September. | Protect final quality and submission. | Team agreement and official timing. |
| P-008 | Maintain separate synthetic demo and real pilot data. | Privacy and deterministic demo. | Engineering implementation. |

## Decision entry template

```md
### D-XXX — Title

- Status: proposed / confirmed / superseded / rejected
- Date:
- Owner:
- Source:
- Context:
- Decision:
- Rationale:
- Consequences:
- Alternatives considered:
- Follow-up:
```

## Overnight reversible implementation — 20 September 2026

- D-N01 [ASSUMPTION]: React/TypeScript + FastAPI/SQLite, one instance, persistent lease queue. ADR-001. Reversible local implementation explicitly authorized by owner; no stack approval inferred.
- D-N02 [ASSUMPTION]: one role per account; 72h single-use invitations; published content frozen, clone for editing; resubmit after return.
- D-N03 [ASSUMPTION]: feedback after teacher review; hints_first releases only teacher-authored hints. Supersedes immediate AI explanation in historical core-flow wording.
- D-N04 [CONFIRMED constraint / ASSUMPTION choice]: owner cap $1/M both directions. Qwen 3.8 Flash selected provisionally after live comparison and Gemini regression (2/6 on follow-up, including a Russian decimal-comma error); hard provider price cap, 50 external attempts/day. See AI report. Luna excluded for output price $1.20/M.
- D-N05 [CONFIRMED]: no push, merge, main changes, public deploy or outbound messages overnight. Live OpenRouter calls on synthetic fixtures explicitly authorized.
- D-N06 [CONFIRMED fact]: official PDF establishes bot or bot+MiniApp, Docker, 40/60 evaluation. External launch, final submission and human pilot remain unverified.

- D-N07 [CONFIRMED scope / ASSUMPTION implementation]: owner requested offline MAX integration. ADR-002: secret-checked webhook, bounded durable bot replies, Bridge, guarded external setup scripts. Real token/API/domain not used overnight; TLS/partner setup remain owner gates.
- D-N08 [ASSUMPTION]: 60KB UTF-8 AI context ceiling; longer work stays intact for manual review. No silent truncation; no automatic model-cost escalation.

- D-N09 [ASSUMPTION]: returned work prefills the last submitted answers into a new attempt, without changing that original. Read-only history exposes only role-authorized data; learner waiting/review and tutor waiting/resubmission refresh automatically. This implements FR-SUB-004/005 and evidence inspectability, not editable historical grades.

- D-N10 [ASSUMPTION, reversible, owner overnight instruction]: несданные ответы приватны ученику; преподаватель получает только отправленную попытку. Сетевой запрос клиента ограничен 15 с с сообщением о возможном сохранении действия. Seed дополняет отсутствующие fixtures без перезаписи работ. API/model/schema migrations не требуются.

- D-N11: owner 21.09 broadened feature implementation to all team proposals; checklist 30 tracks unfinished work. Reversible additions: autosave after 2 s, deterministic recommendations from confirmed evidence, private aggregate analytics, TXT-only material storage in SQLite with explicit AI permission, lesson status. No external notifications, tunnel or paid calls.

- D-N12 (21.09): AI-USE-006 реализован как очередь вопроса с обязательным подтверждением преподавателя, общий бюджет и отдельный prompt question-v3; ADR-004. Живые синтетические v1/v2 недостатки сохранены, v3 даёт уместную подсказку.

- D-N13 (21.09): небольшие группы преподавателя с отдельными копиями работ/занятий, без раскрытия состава ученикам; ADR-005.

- D-N14 (21.09): TEAM-096 - генерация 1–5 заданий по разрешённому TXT в отдельной очереди; только приватный черновик, снимок исходного материала приложен; ADR-006.

### D-N15 — файлы ученика
Решила так, можно переиграть: TXT до 60 KB суммарно, три файла; сохраняются в SQLite отдельными снимками. Без нового сервиса и OCR; AI получает текст с прежними ограничениями. ADR-007.

### D-N16 — родитель
Решила так, можно переиграть: отдельная роль только для сводки подтверждённых навыков/расписания, приглашение и отзыв преподавателем. Реальные аккаунты закрыты GUARDIAN_DATA_APPROVED до утверждения порядка выдачи доступа. ADR-008.

### D-N17 — совместная библиотека
Решила так, можно переиграть: пространство коллег с общей библиотекой неизменяемых шаблонов. Личные работы и ученики не становятся общими при вступлении; копии принадлежат скопировавшему преподавателю. Совместная проверка — отдельный вопрос. ADR-009.

### D-N18 — каталог репетиторов
Решила так, можно переиграть: анкеты по явному включению преподавателем, поиск по предмету/цене, заявка ученика и согласие преподавателя создают связь. Без выдуманного рейтинга, комиссий и проведения денег. ADR-010.

### D-N19 — граф и аналитика
Решила так, можно переиграть: граф задаёт преподаватель, состояния берутся только из подтверждённых ответов. Метрики — ожидание и расхождения проверок; никакой выдуманной экономии времени/эффективности. ADR-011.

### D-N20 — данные аккаунта
Решила так, можно переиграть: authenticated JSON export и отменяемый запрос удаления. Окончательное удаление — оператор после политики и backup, без автоматической ночной обработки. Тесты удаления только в временных БД. ADR-012.

## D-N21 — Opt-in reminders, monitoring, feedback and context (21.09)

Решила так, можно переиграть: напоминания только по явному согласию, час/сутки, три попытки, без персональных деталей. MAX остаётся выключен. ADR-013; N-26/27. Мониторинг — ограниченная локальная CLI, без внешних оповещений. Добавлены полезность/жалоба на разбор и предмет/уровень в минимальном AI-контексте. Новая context_version не подменяет историческое доказательство живого assessment-v2; нужен педагогический пересмотр на пилоте.

## D-N22 — Фильтры списка работ

TEAM-030: активные, просроченные, завершённые, черновики. Просроченной считается опубликованная несданная/возвращённая работа с истёкшим сроком; ожидающая проверки не просрочена. Решила так, можно переиграть. browser/work-status.spec.ts.

## D-N23 — Репетиция без ввода в окна (21.09)

По последнему указанию владельца синтетический ввод в окна запрещён. Решила так, можно переиграть: единый API-прогон со штатным worker и реальным AI, тесты ошибок/прав, чтение прежних снимков. Не объявлять это ручной/UI/MAX-репетицией. Платежи, видео, двусторонний календарь, co-review и универсальный AI до решения владельца не разрабатываем. Загрузчик .env больше не переносит секреты в os.environ; runtime-настройки применяются перезапуском контейнера.

## 22.09.2026 — личная VM для публичного RePrep

[CONFIRMED] Владелец разрешил Docker и постоянный HTTPS на личной VM, с сохранением lct-gaz-gaz. Локальные коммиты без push/merge. [ASSUMPTION] Выбран отдельный hostname reprep.2-26-49-28.nip.io при неизменном IP; ещё не развёрнут. [OPEN] SSH недоступен после трёх попыток; см. 34_VM_DEPLOYMENT_RU.md.

## 22.09.2026 — автоматическая регистрация MAX при выкатке

[CONFIRMED] Владелец поручил включение/регистрацию webhook как часть одной команды развёртывания. Реализован явный deploy --apply: локальная подготовка по умолчанию без SSH/MAX; на VM сборка, production, HTTPS-проверки, POST subscriptions и GET read-back. Обычный старт приложения не меняет подписки. Боевой demo выключен, AI-политика не изменена. Удалённый запуск не проверен из-за принятого сетевого блокера.

## 22.09.2026 — публичный стенд

[CONFIRMED] По разрешению владельца выполнена выкатка на личную VM: reprep.2-26-49-28.nip.io, backend 127.0.0.1:8030 (8020 занят соседом), общий Caddy 80/443, отдельные Docker project/volume/release. Проверены внешний TLS, отказы auth, подписка MAX и автоматический подъём контейнера после restart Docker. Полный reboot VM не выполнялся.

## 2026-09-23 — Telegram
[CONFIRMED] По прямому поручению владельца подключён дополнительный канал @MaxFuckYouBot; общий учебный backend с MAX, изолированные идентификаторы и сессии. См. adr/0004-telegram-adapter.md. Разрешения на реальные данные/AI не расширены.

## 2026-09-24 — Единственный домен
[CONFIRMED] По прямому решению владельца только https://reprep.ru/. Старый nip.io не обслуживает приложение и не разрешён как Origin. Кнопка меню Telegram и webhook используют основной домен. Main App URL в BotFather и кабинете MAX необходимо заменить вручную.

## 2026-09-24 — Telegram только для тестирования
[CONFIRMED] Владелец уточнил: Telegram подключён исключительно как временный тестовый канал; решение для хакатона должно работать в MAX. После тестирования Telegram отключается через TELEGRAM_BOT_ENABLED, окончательный момент определит владелец. Новые продуктовые изменения делаются в общем интерфейсе и backend, без зависимости от Telegram. Сейчас тестовый Telegram не отключаем.

## D-DESIGN-FOUNDATION — Токены, темы и базовое оформление — 2026-09-30

`[CONFIRMED]` По прямому поручению владельца через Jarvis перенести в приложение 36 глобальных токенов неизменяемого `design-mockup/`, сохранив имена и значения, системную светлую/тёмную тему, 17 px основного текста и оформление базовых элементов. Именованных токенов шрифта/отступов в эталоне нет: используются его значения, новые имена не вводятся (OQ-DESIGN-001). Обычный текст проверяется на 4.5:1, существенные знаки/границы/заливки — на 3:1. Значки — SVG; шесть прежних глифов в `main.tsx` и `Guardian.tsx` заменяются внутри прежних контейнеров. Порядок блоков, действия, учебная механика и права не меняются. Серия и путь относятся к параллельной задаче.

Работа только локально в `design/duolingo`: без push, публикации и изменения сдаваемого архива под `f66cf6f`. Основание и совместимость: [ADR-DESIGN-FOUNDATION](decisions/ADR-DESIGN-FOUNDATION.md); контракт, координация и проверка: [DESIGN_FOUNDATION.md](DESIGN_FOUNDATION.md). Решение заменяет неопределённость UX §7 только в пределах перечисленной визуальной основы; OQ-MAX-008 и полный целевой уровень соответствия WCAG остаются открытыми.

## D-DESIGN-INTEGRATION — Кандидат оформления поверх сдачи — 2026-09-30, 09:48 МСК

`[CONFIRMED]` Владелец поручил брать `0b7f17b` за основу и накладывать оформление,
сохраняя демо-вход, повторный вход мессенджера, AI-сценарий и синтетические данные.
Механику разрешено свести только с выключенным `LEARNING_JOURNEY_ENABLED=false`;
при выключении прежними остаются также расчёты графа и обработка повторной сдачи.
Включение отложено до окончания проверки экспертами после заморозки 12:00–14 октября.
Кандидат должен быть проверен к 11:15; при риске задержки сообщить до 11:00.
Этой сессии запрещены push и выкатка: их, точку отката и новый архив/контрольную
сумму владелец передаёт отдельной сессии после готовности. Это более новое
поручение разрешает локальное сведение с `0b7f17b`, ранее отложенное до сдачи.
Результат и ограничения: [45_DESIGN_INTEGRATION_RU.md](45_DESIGN_INTEGRATION_RU.md).

`[OBSERVED]` Во время сверки основная ветка дополнительно получила `5b20b08`
(выход на каждом экране). Для сохранения актуальной сдачи этот коммит включён
в кандидат, исходная ветка не менялась. Адаптирована только шапка на 320 px;
проверены подпись/границы кнопки и смена демо-ролей. Финальный повтор:
200 серверных, 62 браузерных при `false`, 6 при `true`, 1755 измерений контраста
без нарушений. Подробности и ограничения локального провайдера — в отчёте.
