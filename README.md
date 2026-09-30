# reprep — AI-native платформа для репетиторов и учеников в MAX

**reprep** — учебное пространство репетитора и ученика внутри мессенджера MAX: назначение → сдача → предварительный AI-разбор → решение преподавателя → подтверждённый прогресс. Формат: чат-бот MAX с мини-приложением.

## Для проверяющих

| Что | Где |
|---|---|
| Мини-приложение (HTTPS) | https://reprep.ru/ |
| Бот MAX | @t792_hakaton_max_bot («Хакатон МАХ 792»), вебхук `https://reprep.ru/api/max/webhook` |
| OpenAPI 3.1 | https://reprep.ru/api/openapi.json, Swagger UI — https://reprep.ru/api/docs |
| Описание API и тестовые данные | [DATA-API.yaml](DATA-API.yaml) |
| Проверка готовности | https://reprep.ru/api/ready |
| Запуск через Docker | `docker compose up --build -d` → http://127.0.0.1:8000 (см. «Быстрый локальный запуск») |

На публичном стенде вход только через MAX (подписанный `init_data`), демо-аккаунты выключены (`APP_ENV=production`, `DEMO_ENABLED=false`). Для проверки API без MAX поднимите решение из Docker локально: там доступны демо-роли преподавателя, ученика и родителя.

### Что настоящее, а что смоделировано

- **Настоящее:** бот MAX и его API (`platform-api2.max.ru`), MAX Bridge мини-приложения, AI-разбор через публичный документированный API OpenRouter (модель `qwen/qwen3.8-flash`).
- **Синтетическое:** все демо-аккаунты, ученики, задания и анкеты репетиторов вымышлены. На стенде `AI_SYNTHETIC_ONLY=true`: внешний AI применяется только к синтетическим данным, работы реальных пользователей идут на ручную проверку преподавателем.
- **Без Docker-аналога (внешние сервисы):** MAX Bot API и OpenRouter. Без ключа OpenRouter решение работает на явно обозначенной проверке по эталонам — это **не нейросеть**.
- **Не реализовано и не имитируется:** приём платежей и комиссии (статус оплаты фиксируется вручную, деньги не проводятся), OCR/фото, видеозвонки. Напоминания в MAX проверены тестовым транспортом, не на реальных устройствах.

> reprep combines a tutor's daily work and a learner's study process in one platform, with AI embedded in the context of each learner.

The intended distinction from ordinary LMS products and marketplaces is learner-contextual AI embedded in the learning process. The business model is **subscriptions for tutors and learners**, followed by **commissions for tutor matching and payments through the platform**. Prices, usage limits and rollout order remain open.

## Team

| Member | Role |
|---|---|
| Дмитрий Ярочкин | CAIO |
| Иван Курбан | CTO |
| Марк Сердюк | CPO |

See the [owner-approved project passport in Russian](docs/22_PROJECT_PASSPORT_RU.md). The concept describes the intended product, not completed features or validated commercial results.

The first release focuses on the tutor-led learning cycle: assignment, submission, AI analysis, explanation, tutor review and confirmed progress. Scheduling, materials, communication and payment status support that workflow. Standalone AI tutoring and subscription billing are later expansion work; matching, payment processing and commissions remain outside the current hackathon scope. These release boundaries do not narrow the full product vision.

Развёртывание на VM: [одна команда и проверенные ограничения](docs/35_DEPLOY_ONE_COMMAND_RU.md), [отчёт выкатки](docs/36_PUBLIC_DEPLOYMENT_RU.md), [домен и MiniApp](docs/39_REPREP_DOMAIN_RU.md). Внутренние материалы команды: [аудит](docs/43_AUDIT_MORNING_RU.md), [checklist](docs/30_TEAM_CHECKLIST_RU.md), [вопросы владельцу](docs/15_OPEN_QUESTIONS.md).


Для уже настроенной локальной машины: `bash scripts/demo.sh` — одна команда сборки/запуска с ожиданием healthcheck.

## Быстрый локальный запуск

Нужны Docker/Compose. Если .env уже настроен, **не перезаписывайте его**. На чистом checkout создайте .env по .env.example и заполните OPENROUTER_API_KEY локально. Ключ никогда не добавляется в Git.

```sh
# Только на чистом checkout без .env:
cp -n .env.example .env
chmod 600 .env
# Затем заполнить ключ в редакторе.
docker compose up --build -d
```

Открыть **http://127.0.0.1:8000**. Появятся кнопки «Я преподаватель» и «Я ученик». Демо содержит вымышленные аккаунты и математическое задание. В разных окнах/вкладках можно проверить обе роли. Не вводите настоящие данные детей.

Без ключа работает явно обозначенная проверка по эталонам, **не нейросеть**. Для настоящего AI нужны и OPENROUTER_API_KEY, и OPENROUTER_MODEL. Выбран qwen/qwen3.8-flash; маршрутизация ограничена $1/M входных и выходных токенов. AI_DAILY_LIMIT=50 — временный лимит внешних вызовов очереди за UTC-день на базу.

Остановить: `docker compose stop`. База сохраняется в именованном volume. Не запускайте `down -v`, если данные нужны. Контейнер слушает только loopback; наружу этот compose ничего не публикует.

## Запуск без Docker

Python 3.14, Node 22.12+ (локально также проверено на Node 25):

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
npm ci
npm run build
.venv/bin/python -m uvicorn apps.server.main:app --host 127.0.0.1 --port 8000
```

Настройка .env такая же. Не запускайте Docker и uvicorn одновременно на одном порту. Для разработки клиента — `npm run dev` (порт 5173, API-прокси на 8000).

## Воспроизвести основной сценарий

1. «Я преподаватель» → «Создать задание», выбрать Сашу, заполнить условие/эталон/навык, назначить.
2. В отдельной вкладке «Я ученик» → открыть работу, ответить, «Сохранить ответы» или «Отправить работу».
3. В кабинете преподавателя открыть работу. При доступном OpenRouter появится имя модели и предварительный разбор. При отказе провайдера оригинал остаётся доступным ручной проверке.
4. Проверить содержание. «Подтвердить разбор» сохраняет вывод модели; «Сохранить мою проверку» — исправленный преподавателем результат. Можно вернуть с комментарием или отклонить без прогресса.
5. У ученика открыть работу повторно и «Мой прогресс»: только опубликованная преподавателем обратная связь и доказательства по навыкам.

Черновики сохраняются по кнопке, автоматически не отправляются. Опубликованное задание неизменно — правка через копию. Повторная попытка доступна после возврата и начинается с прежних ответов. «История попыток» показывает отправленные оригиналы; новые ответы не меняют предыдущие. Сброс только демо-данных — настройки преподавателя, «Восстановить демо»; завершает все демо-сессии.

## Проверки

```sh
.venv/bin/python -m pytest -q
npm run build
python3 scripts/check_secrets.py
# При запущенном сервере. Использует установленный Chrome; один worker.
npm run test:e2e
# Другой адрес: E2E_URL=http://127.0.0.1:8001 npm run test:e2e
```

Браузерный тест создаёт синтетическую работу и при настроенном ключе делает настоящий платный AI-вызов. Для полностью локальной проверки запустите сервер с пустым OPENROUTER_MODEL. CHROME_PATH можно указать для другой ОС.

Отдельные **платные** исследовательские команды (не входят в обычный pytest):

```sh
.venv/bin/python scripts/benchmark_ai.py
.venv/bin/python scripts/live_e2e.py
```

Результаты складываются в игнорируемый artifacts. Версионированные факты ночного исследования — docs/evidence. Стоимость невелика, но это реальные API-вызовы, не заглушки.

## API и структура

- `/api/health` — работоспособность процесса.
- `/api/docs` — Swagger UI (ресурсы UI загружаются с jsDelivr).
- `/api/openapi.json` — OpenAPI, доступен без CDN.
- [DATA-API.yaml](DATA-API.yaml) — локальные тестовые доступы и релизные ограничения.
- `apps/server` — FastAPI, SQLite, постоянная очередь, права, AI-адаптеры.
- `apps/client/src` — React/TypeScript, мобильные и десктопные экраны.
- `tests` — API/безопасность/браузер; `scripts` — воспроизводимые проверки.

Один uvicorn worker, один экземпляр приложения на SQLite. Очередь хранится в базе, просроченная аренда задания возвращается в работу. При падении после сетевого вызова возможна повторная платная проверка (at-least-once); прогресс идемпотентен по review/task. Для масштабирования потребуется отдельная очередь/БД и миграционная стратегия.

## Перед внешним запуском

Нужно согласованное размещение с HTTPS, MAX-ботом и реальным тестом запуска. Реальный MAX API проверяли, но запуск MiniApp внутри мессенджера не пройден. Текущий MAX-токен нужно ротировать после инцидента вывода в инструментальный ответ (подробности в вопросах); Git-проверки проходят. DEMO_ENABLED запрещён при APP_ENV=production. Для реальных данных внешняя AI-проверка выключена, пока не согласованы данные и политика. Полное удаление аккаунта, bot-уведомления, OCR, файлы кроме UTF-8 TXT, автоплатежи и видеозвонки отсутствуют.

До интеграции прочитать [AGENTS.md](AGENTS.md), [источники истины](docs/00_SOURCE_OF_TRUTH.md) и [ADR](docs/adr/001-working-mvp.md). Нужны инженерное ревью и тестовый стенд; локальный успех не объявляется завершённым релизом.

## Documentation map

| File | Purpose |
|---|---|
| `AGENTS.md` | Mandatory operating rules for coding agents and contributors |
| `docs/00_SOURCE_OF_TRUTH.md` | Status system, precedence and uncertainty rules |
| `docs/01_PRODUCT_VISION.md` | Product vision, positioning and strategic boundaries |
| `docs/02_PRD.md` | Product requirements document and success definition |
| `docs/03_SCOPE_AND_PRIORITIES.md` | P0/P1/P2 scope and explicit non-goals |
| `docs/04_USERS_AND_JOURNEYS.md` | Users, jobs, journeys and edge cases |
| `docs/05_FUNCTIONAL_REQUIREMENTS.md` | Detailed functional requirements with IDs |
| `docs/06_AI_SYSTEM_SPEC.md` | AI responsibilities, context, outputs, safety and evaluation |
| `docs/07_DOMAIN_AND_DATA_MODEL.md` | Domain concepts, proposed entities and lifecycle rules |
| `docs/08_API_AND_EVENTS.md` | Conceptual API boundaries and analytics events |
| `docs/09_ARCHITECTURE_AND_INTEGRATIONS.md` | Architecture constraints and unresolved technology choices |
| `docs/10_SECURITY_PRIVACY_SAFETY.md` | Security, privacy, minor safety and content handling |
| `docs/11_UX_UI_REQUIREMENTS.md` | UX principles, screens and state requirements |
| `docs/12_TESTING_AND_ACCEPTANCE.md` | Testing strategy and release acceptance gates |
| `docs/13_RESEARCH_METRICS_PILOT.md` | CustDev, metrics and first-client pilot protocol |
| `docs/14_DELIVERY_AND_SUBMISSION.md` | Delivery workflow, releases and hackathon package |
| `docs/15_OPEN_QUESTIONS.md` | Questions that must not be silently answered by agents |
| `docs/16_DECISION_LOG.md` | Confirmed and proposed decisions with rationale |
| `docs/17_GLOSSARY.md` | Shared vocabulary |
| `docs/20_TEAM_BRIEF_RU.md` | Current team and product brief in Russian |
| `docs/22_PROJECT_PASSPORT_RU.md` | Canonical owner-approved project description and team |
| `docs/decisions/` | Detailed records of accepted product and architecture decisions |
| `docs/archive/` | Superseded historical materials, not current requirements |
| `docs/templates/` | Templates for ADRs, features, test reports and pilot notes |

## Дополнительные локальные MAX-проверки

```sh
.venv/bin/python scripts/test_max_mutations.py
# Отдельный сервер, синтетический токен, без платного AI:
MAX_BOT_TOKEN=synthetic-max-test-token DATABASE_PATH=artifacts/max-browser.sqlite3 APP_ENV=test DEMO_ENABLED=true OPENROUTER_MODEL='' .venv/bin/python -m uvicorn apps.server.main:app --port 8002
# В другом терминале:
E2E_URL=http://127.0.0.1:8002 E2E_MAX_SIM=true npm run test:e2e
```

Bridge подменяется локальным fixture только в соответствующем тесте. Настоящие MAX API не вызываются. В обычном browser suite MAX-симуляции пропускаются без E2E_MAX_SIM=true. Schema v2 добавляет max_outbox без удаления существующих учебных данных.

Для дополнительной проверки настоящего публичного JS Bridge (не API бота):

```sh
mkdir -p artifacts
curl --fail --silent --show-error https://st.max.ru/js/max-web-app.js -o artifacts/max-web-app.js
E2E_URL=http://127.0.0.1:8002 E2E_MAX_SDK_PATH=artifacts/max-web-app.js npm run test:e2e -- --grep 'official Bridge'
```

Библиотека в этом тесте подаётся из локального файла, родитель MAX симулируется. Снимок не включается в Git и не заменяет реальную проверку устройства.

Утром на **этой уже подготовленной машине**: `bash scripts/demo.sh --prepared` — запускает имеющийся образ без сборки и скачивания. Нужен работающий Docker. На новом checkout или после изменения кода используйте `bash scripts/demo.sh` для пересборки.

### TXT в ответах ученика

До трёх файлов UTF-8 суммарно 60 KB, к числовому или текстовому заданию. Сохраняются вместе с черновиком, после сдачи неизменяемы и доступны в истории попыток. Текст участвует в ограниченном AI-контексте; слишком большая работа переходит преподавателю. PDF/фото/OCR не поддерживаются.

### Родительский кабинет

Демо: преподаватель → Ученики → выбрать ученика → «Создать приглашение родителю». В отдельной вкладке «Я родитель» → вставить код → выбрать ученика. Видны подтверждённые навыки и расписание. Преподаватель может отозвать доступ. GUARDIAN_DATA_APPROVED=false по умолчанию блокирует такой доступ для реальных пользователей до согласования правил. Миграция 5 сохраняет старые аккаунты/связи; перед обновлением делайте backup.

### Коллеги и шаблоны

В разделе «Ученики» преподавателя: создать пространство, пригласить коллегу, выбрать свою работу и поделиться её условиями/эталонами. Коллега вступает по коду, копирует шаблон для своего ученика в приватный черновик. Файлы и личные ответы не переносятся. Владелец исключает участника; копии, уже созданные им, сохраняются. Для демонстрации второго преподавателя на входе есть отдельная кнопка.

### Каталог репетиторов

«Репетиторы» → преподаватель заполняет анкету и включает видимость → ученик ищет предмет и оставляет заявку → преподаватель принимает → появляется обычная учебная связь. Цена фиксируется как условие заявки; деньги приложение не проводит. Демо-анкеты видны только демо-аккаунтам.

### Данные аккаунта

В настройках — скачать собственные данные JSON, запросить удаление и отменить запрос до обработки. Окончательное удаление требует оператора и утверждённой политики. Сначала `python -m apps.server.account_erasure --user-id ID` показывает только план. Применение требует `ACCOUNT_DELETION_APPROVED=true`, `--apply --confirm-user-id ID --backup NEW_PATH`. Backup и ранее созданные копии других участников требуют отдельной политики; см. ADR-012. Ночью рабочая БД не удалялась.

### Напоминания и проверка доступности

В настройках пользователя есть отдельное согласие на напоминания MAX. Нужны вход через MAX, прямой диалог с ботом и включённая владельцем доставка. По умолчанию отправка отключена; локальные напоминания доступны. Сообщения о занятиях попадают в очередь за час, о сроках работ — за сутки; одинаковые сроки объединяются. Перед отправкой проверяется, что событие актуально и согласие не отозвано. Ошибки доставки видны в настройках. Это проверено локально тестовым транспортом, не в реальном MAX.

Разовая проверка доступности: `.venv/bin/python scripts/monitor.py`; десять проверок с интервалом 30 секунд: `.venv/bin/python scripts/monitor.py --count 10`. Код выхода 1 означает хотя бы один отказ. Проверяется приложение и БД, не MAX/OpenRouter; внешнее наблюдение и канал оповещений требуют настройки владельцем на выбранном сервере.

### Генеральная API-репетиция

`.venv/bin/python scripts/rehearsal.py` — единый офлайн-прогон 52 шагов со штатным worker и явной фикстурой AI, без изменения рабочей БД. `--live` дополнительно включает два платных синтетических вызова настроенного OpenRouter; не включайте его для обычного CI. Результаты и ограничения — [отчёт репетиции](docs/33_REHEARSAL_REPORT_RU.md). Это не ручной проход интерфейса и не MAX.
