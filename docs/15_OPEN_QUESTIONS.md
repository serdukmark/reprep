# Вопросы владельцу к утру — 20 сентября 2026

Ночью использовано разрешение владельца принимать обратимые решения. Ни один вопрос ниже не ожидал ответа и не останавливал доступную локальную разработку. Приоритет — сверху вниз. Исторический реестр сохранён ниже; актуальные уточнения в этом разделе имеют приоритет над его старым статусом.

## P0: блокируют внешнее демо в MAX

### N-01. На каком HTTPS-домене и через какого MAX-бота показываем продукт?
- Почему владельцу: нужны командный доступ, выбор инфраструктуры и разрешение внешнего размещения; публикация ночью запрещена.
- Варианты: существующий командный сервер/домен — без новой подписки, но нужен доступ и TLS; отдельный VPS — платный тариф после выбора, отдельная эксплуатация; только localhost — 0 ₽, подходит для внутреннего просмотра, **не закрывает MAX-кейс**.
- Пока: **решила так, можно переиграть** — контейнер, MAX Bridge, API проверки подписи, защищённый webhook и очередь ответов, скрипты утренней регистрации; токен бота не извлекала в конфигурацию. Никакого деплоя/сообщений. После доступа: HTTPS, привязка MiniApp, запуск из MAX на мобильном и web, проверка реального init_data.

### N-02. Кто проверит педагогический эталон и AI до защиты?
- Почему владельцу: нужен взрослый предметный преподаватель; агент не может объявить свой тест пользовательским пилотом.
- Варианты: коллега-преподаватель проверяет 30–50 синтетических решений — время эксперта, без данных детей; оплаченный эксперт — бюджет согласовать; оставить 6 агентских примеров — 0 ₽, но слабое доказательство качества и риск неверной оценки.
- Пока: **решила так, можно переиграть** — математика, 6 сложных русских примеров; финально Qwen: 5/6 в сравнении, 4/6 в сквозном прогоне; Gemini деградировала до 2/6. Обратная связь и прогресс только после решения преподавателя; ошибки не скрыты.

### N-03. Кто собирает окончательные артефакты и когда точный дедлайн?
- Почему владельцу: распределение ответственности в команде, время закрытия формы и правила доступа сообщает организатор.
- Варианты: один ответственный собирает PDF/commit hash/ссылку MAX и DATA-API — меньше рассинхронизации; каждый сдаёт свою часть — выше риск неполного пакета; внутренний freeze за сутки — меньше времени на функции, больше на проверку.
- Пока: **решила так, можно переиграть** — README, Docker, lock-файлы, OpenAPI и DATA-API.yaml подготовлены; внешний URL, итоговая презентация PDF и отправка отсутствуют. Известна дата 30 сентября, точное время остаётся открытым. Main и remote не изменялись.

### N-11. Кто предоставляет доверенную CA-цепочку для нового MAX API-host?
- Почему владельцу: доверие сертификату и настройки сервера нельзя подменять отключением TLS verification.
- Варианты: существующее системное доверие — без дополнительных расходов, нужно проверить; согласованный PEM bundle Минцифры — время на проверку источника/монтаж в контейнер; не включать исходящий бот — 0 ₽, но кнопочный ответ бота не демонстрируется.
- Пока: **решила так, можно переиграть** — platform-api2.max.ru, TLS verification включена, MAX_CA_BUNDLE опционален. Сертификаты ночью не устанавливались; инструкция не обещает, что один адрес заменяет DNS/TLS/регистрацию.

## Деньги и доступы

### N-04. Какой бюджет AI на пилот и нужна ли более дорогая модель?
- Почему владельцу: стоимость и ограничения подписки определяет владелец.
- Варианты: Gemini 2.5 Flash Lite $0.10/$0.40 за 1M — около 0.04 ₽ за измеренную короткую работу; Qwen 3.8 Flash $0.15/$0.47 — медленнее, около 0.055 ₽ в сравнении; исследовать Luna $0.20/$1.20 — превышает порог выхода, без разрешения не вызывать.
- Пока: **решила так, можно переиграть** — Qwen, hard max_price $1/M на вход и выход, 50 внешних попыток/UTC-день на базу; стоимость и ответы в 23_AI_MODEL_COMPARISON_RU.md. Превосходство Luna не установлено, она не подключена.

### N-05. Можно ли отправлять настоящие работы в OpenRouter и какой срок хранения?
- Почему владельцу: обработка данных детей, условия провайдера, согласия и права на материалы требуют ответственного за данные.
- Варианты: только синтетика — 0 ₽ юридического внедрения, без доказательства реального пилота; обезличенная работа взрослого преподавателя с согласованием — время на процедуру; реальный ученический пилот — согласия, политика, удаление/экспорт, возможные юридические расходы.
- Пока: **решила так, можно переиграть** — AI_SYNTHETIC_ONLY=true, AI_DATA_APPROVED=false. Для настоящего MAX-аккаунта внешняя AI-проверка заблокирована; ручная работает. Выгрузка прогресса есть, полного удаления аккаунта/согласий/retention-job пока нет. data_collection=deny не считается разрешением на данные детей.

## P1: обратимые продуктовые решения

### N-06. Какой предмет и тип работ демонстрируем первым?
- Почему владельцу: соответствие первому клиенту и сильному сценарию команды.
- Варианты: математика с числами/выбором/коротким объяснением — уже реализовано, 0 дополнительных дней; русский с развёрнутым текстом — нужны предметные рубрики и оценка; фото рукописи/OCR — платный мультимодальный этап и отдельная проверка распознавания.
- Пока: **решила так, можно переиграть** — математика, три текстовых типа, до 20 заданий. Фото, OCR и файлы не притворяются работающими.

### N-07. Когда ученик видит объяснение и когда может пересдать?
- Почему владельцу: педагогическая политика и нагрузка преподавателя.
- Варианты: после подтверждения — безопаснее, ожидание человека; подсказки преподавателя сразу — меньше тупиков; полный AI-разбор сразу — быстрее, риск показать неверное объяснение.
- Пока: **решила так, можно переиграть** — after_review по умолчанию; hints_first показывает только заранее написанную подсказку преподавателя. Новая попытка только после возврата; исходники прошлых попыток сохраняются. Опубликованное задание неизменно, редактирование через копию. Дедлайн информационный, не блокирует сдачу.

### N-08. Нужны ли обе роли на одном MAX-аккаунте?
- Почему владельцу: зависит от клиента и UX онбординга.
- Варианты: одна роль — проще, уже работает; переключение ролей — новые права и тесты; отдельный администратор — больше сущностей и ответственности.
- Пока: **решила так, можно переиграть** — роль выбирается при первом входе, затем сервер её сохраняет. Приглашение одноразовое на 72 часа, код передаётся человеком; автоматических сообщений нет.

### N-09. Какую обвязку оставить в демо: расписание, материалы, оплаты?
- Почему владельцу: нужно выбрать ценность для репетитора, а не объём экранов.
- Варианты: весь текущий минимум — создание занятия, HTTPS-ссылки, ручная отметка оплаты; оставить только P0 — меньше демонстрационных переходов; подключать календарь/видеозвонки/эквайринг — доступы, комиссии и интеграционные риски.
- Пока: **решила так, можно переиграть** — только минимальная обвязка без внешних действий. Оплата вручную видна только репетитору; автопроверки переводов, видеоконференций, push-напоминаний нет.

### N-10. Кто проводит инженерное ревью и как вливаем в командный код?
- Почему владельцу: репозиторий командный; AGENTS.md требует ответственного инженера и тестовый стенд.
- Варианты: ревью ветки feat/reprep-mvp и PR утром — обычный review; выборочный перенос отдельных модулей — больше ручной интеграции; иной стек команды — сохранить API/fixtures, заменить реализацию, дороже по времени.
- Пока: **решила так, можно переиграть** — React/TypeScript + FastAPI + SQLite, один процесс/один контейнер. Локальная ветка и коммиты; без push/merge/main. SQLite — решение для демо, не обоснованный выбор для большой многопользовательской эксплуатации.

## Уточнения по официальному кейсу и документации

Источник: [официальный PDF, 22 страницы](official/education-case.pdf), получен из командного топика «Образовательные решения». Подробности — [24_CASE_AND_MAX_RU.md](24_CASE_AND_MAX_RU.md).

- OQ-HACK-002: кейс перечисляет возможные образовательные направления; обязательность всех тем сразу не следует из PDF.
- OQ-HACK-003: бот или бот с MiniApp; не просто самостоятельный сайт.
- OQ-HACK-004: онлайн-оценка 40% продукт / 60% техника, бонус 0.15 за полезную дополнительную MAX-возможность.
- OQ-HACK-005/007: Docker обязателен, сборка до 5 минут без скачивания базовых образов; README, фиксированные зависимости, исходники с commit hash, работающий MAX, PDF-презентация; собственный API — HTTPS, OpenAPI3 и DATA-API.yaml с тестовыми данными/доступом.
- OQ-HACK-001: старое предположение «только школы/вузы» слишком узкое. Направление репетиторов соответствует широкому описанию образования; отдельного одобрения организатором именно reprep не было.
- OQ-MAX-001: HMAC-проверка реализована и проверена синтетическими тестами. Реальный запуск/публикация остаются N-01.
- OQ-TECH-001/002/003/006/009 и продуктовые политики: временные решения — ADR-001, не молчаливое утверждение владельцем.

---

## Исторический реестр до ночной разработки

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
