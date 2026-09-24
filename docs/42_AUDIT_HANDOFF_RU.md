# Состояние полного аудита — 24.09.2026

Задача активна, не завершена. Продолжать exhaustive browser audit. Никакого deploy/push/production mutation/окон владельца. Только отдельный headless Chrome; не запускать подагентов. Исходный HEAD 4a6249d, ветка feat/reprep-mvp.

## Текущий запуск
- Изолированный сервер: PID47084, exec session63667, `.venv/bin/python -m uvicorn tests.audit_server:app --host 127.0.0.1 --port 8017 --no-access-log`.
- Только synthetic SQLite artifacts/deep-audit/browser.sqlite3. AuditProvider наследует OpenRouterAdapter для проверки возможностей, но ВСЕ методы локальные, никакой платной сети. Marker UNAVAILABLE ждёт3с и бросает; EMPTY/GARBAGE возвращают невалидное, SLOW ждёт4с. Генерация fixture; вопросы — отказ.
- Playwright workers1, traces on в режиме E2E_AUDIT. Fixture reset каждого теста + отдельный virtual IP, чтобы тесты не расходовали общий auth rate limit. Продуктовый rate limit не менялся.
- Текущий прогон roles-round5: account роли, invitations, workspaces, failure. Узнать результат по JSON artifacts/deep-audit/roles-round5.json; номер процесса в диалоге.
- Headless CLI требует require_escalated; никогда не использовать окна владельца.

## Исправления (локально, НЕ выкачены)
- AUD001: ChoiceSelect видимый button не имел role/доступного имени. Добавлено. audit-choices passed; mutation-choice-role падает ожидаемо.
- AUD002: option без value давал пустую строку: не сохранялся single_choice, граф навыков, выбор второго предмета. Теперь fallback текст option. audit-boundaries/skill-graph/catalog passed, mutation-choice-value падает ожидаемо.
- AUD003: главная игнорировала старые занятия без status. Fallback scheduled. audit-access AUD003 passed, mutation-lesson-status падает ожидаемо.
- Сборка dist актуальна: index-yYdTfKLs.js. Код и тесты ещё не закоммичены.

## Доказательства
- suite-round2:22passed,3устаревших тестовых ожидания,1skip.
- faults-access-before:8passed,2failed (AUD003 + неверное ожидание «Завершено» вместо «Проведено»).
- suite-round3:36passed,2ошибки новых тестов (клик disabled группы без участников; label Предмет вместо Предмет заявки),1skip. Эти два теста исправлены и passed round4.
- remaining-round4:9passed,2failed. Learner invite длинный ввод не обязан обрезаться: проверка изменена на видимую ошибку сервера. failure старый сценарий требует медленного отказа, fixture отказ был слишком быстрый и polling не возникал — добавлена задержка3с только fixture. Эти2 перепроверяются round5.
- AI UNAVAILABLE/EMPTY/GARBAGE/SLOW: все полные UI-сдачи + ручное/AI решение + подтверждение ученику прошли.
- Формы profile/workspace/group/lesson/material: blank/long/Unicode/offline retry/dblclick/reload прошли.
- guardian/colleague revoked invitation через UI прошли.
- Карта77строк docs41 и scenarios.json: часть статусов обновлена, ОСТАЛЬНОЕ обновить по evidence; частичный проход не полный pass.
- docs/QA_INDEPENDENT.md — чужой независимый аудит, появился во время работы; не менять/не включать в свой коммит автоматически. В нём те же дефекты option и dashboard, могут дописываться другие.

## Дальше
1. Разобрать round5 и устранить реальные дефекты; тестовые ошибки не выдавать за продуктовые.
2. Заполнить пробелы77сценариев: UI review reject/retry, preview/remove/duplicate/edit-conflict, parent экспорт, все role boundaries, UI expired invitations (server tests есть), граф цикл/удаление, редактирование групп, обратная связь все варианты, файлы validation, модель/context-too-large, browser back/2tabs/session variants. Учёт N/A объяснять; ещё нельзя говорить всё проверено.
3. Серверный pytest154+ ещё НЕ перепрогнан в этом аудите. Выполнить после текущих браузерных тестов. Мутации для трёх локальных багов уже доказаны браузером; серверные mutation scripts по правам доступны scripts/test_*_mutations.py.
4. Полный окончательный прогон с flags: E2E_URL=http://127.0.0.1:8017 E2E_AUDIT=1 E2E_MAX_SIM=true E2E_FAULT_SIM=true E2E_FIXTURE_GENERATION=1 E2E_MAX_SDK_PATH=artifacts/max-web-app.js PLAYWRIGHT_JSON_OUTPUT_NAME=artifacts/deep-audit/final.json npx playwright test --workers=1 --reporter=list,json --output=artifacts/deep-audit/final-traces.
5. Docs41 обновить по конкретным результатам, не подменять UI API-тестами. Реальный MAX исключён, AI здесь fixture, production не проверяется этими локальными прогонами.
6. Secret scan scripts/check_secrets.py перед локальным коммитом, никаких secrets output. Не stage чужой QA_INDEPENDENT.

## Более свежее состояние
- Сервер тот же PID47084/session63667. Последний runner validation-round6 session62240 (audit-validation, audit-rejection).
- AUD004 исправление в Assignment.tsx: rejected review явно показывает note. Before тест красный; after runner62240. Нужна намеренная мутация и повтор.
- Build index-Bp52ohAB.js. pytest.ini новый: testpaths=tests; pytest154 passed/2 warnings. Старый default pytest собирал scripts/test_* и падал SystemExit, временные мутации НЕ изменяли source.
- New audit-account-roles (3passed), audit-invitations (3passed), audit-generation (passed), audit-validation (в процессе), audit-rejection (beforefailed). workspaces открытая вкладка после удаления: passed после выбора ученика длякопии.
- Пользователь подтвердил ночной автономный режим, держать вопросы и пакет к утру. Работа остаётся активной, полнота пока не достигнута.

## Последняя точка (после дополнительных прогонов)
- Audit server перезапущен: session46016/PID93459, 8017. Telegram включён synthetic token; cfg публичный origin https://audit.invalid (никуда не ходит). ASGI тестовый wrapper переводит ТОЛЬКО Origin http://127.0.0.1:8017 в https://audit.invalid, чужие Origin не трогает. Это fixture для обязательного public URL, НЕ проверка боевой конфигурации HTTPS.
- Добавлен тестовый POST /__audit__/expire-invitations, меняет expires=0 только created приглашений в synthetic DB. Используют browser audit-invitations (3 expired +3 revoked).
- Current runner session24595: auth-round11 (audit-auth12, invitations6, guardian extended1). В round10 тесты пытались .check() у скрытого native radio, исправлены на click visible .registration-role + assert checked; это тестовый дефект, не продуктовый.
- AUD004 after passed(validation-round6), deliberate mutation-rejection-note failed expected. Все4 найденных продуктовых бага локально исправлены и regression/mutation доказаны.
- Extra passed: audit-editing (teacher draft concurrent conflict, preview/remove, editgroup and bulk dblclick); audit-validation (graph cycle/dangling, file types/empty/size/NUL/encoding); audit-submissions context-too-large passed; concurrent two learners +allreportcategories passed concurrent-round9. Пустой report comment разрешён контрактом; не считать дефектом. Product вопросы АУД-Q1/Q2 добавлены docs15.
- Server154 passed. Guardian mutation revoked_summary/revoked_list caught; workspace mutation revoked_member/private_relationship/automatic_publication caught.
- tests/browser/audit-choices.spec.ts добавлен новый narrow longlabel keyboard тест, ещё НЕ запускался. max.spec storage denial расширен reload, ещё НЕ запускался.
- Поддерживать карту docs41/scenarios.json: накопилось много новых подтверждений, ещё не внесены. После текущего прогона обновить и закрыть оставшиеся варианты. Нужен финальный полный run (flags inclMAX/FAULT/GEN), форматирование новых тестов, секретскан, локальный коммит (без чужого QA_INDEPENDENT). Не завершать задачу как «всё прошло», пока матрица неполная.

## Текущая контрольная точка (самая новая)
- Сервер PID32971/session18720, 8017, запущен после AUD005. Build index-RTKiIYoc.js.
- AUD005 найден и исправлен: lost server response after create -> duplicate. Файлы apps/server/models.py (AssignmentInput.client_id excluded metadata), main.py deterministic per-tutor ID + replay conflict, client api.ts Assignment.client_id optional, blankAssignment UUID, main save body sendskey. tests/test_create_retry.py2 +lost-response browser passed. Mutation script passed. DBmigrationне нужна.
- Сейчас полный browser checkpoint session38214, report artifacts/deep-audit/checkpoint-full.json, traces checkpoint-full-traces, flags MAX_SIM/FAULT_SIM/GENFIXTURE все включены. Серверpytest session6993, server-tests.xml. До результатов не начинать второй browserrun.
- auth-round11:19passed (allroleMAX/TGsim, forged/expired/duplicate, invitations3revoked3expired, guardiannetworkforeignchild). ui-round12:5passed (narrowlongchoice, exportJSONanalytics, storagedenialreload, MAXsim).
- Всеtests/browser отформатированы prettier. Production untouched; коммитов этой задачи ещё нет.
- Следующее по фактическим пробелам: response-lost-after-commit для прочих createформ (group/lesson/material/workspace; могут дублировать, пока НЕ проверено), catalog decline/unpublish/price, plan edits/material links, discussion double/network, role matrices/resources fullUI. Карта77 всё ещё33passed/44неполно — обновить evidence из последнихпрогонов. CSV в карте исправлен на фактическийJSON, родительскийплан отсутствует.
- Передcommitscan scripts/check_secrets.py. docs/QA_INDEPENDENT.md чужой файл, не stage. Все5 локальныхдефектов до AUD005 имеют red/green+mutation.

## После checkpoint
- Общий71test run:70passed1failed (6.8мин), failure толькоharness /expire-invitations SQLiteblockingeventloop. await asyncio.to_thread исправил; expiry-repeat 9passed(3rolesx3),39.8с. Полного71/71единымзапуском пока нет.
- Текущий auditserver PID20519/session72813,8017. Browserrunner сейчасНЕТ. Backend156passed,2warnings, secretscan ранееpassed, передcommitповторяется.
- Новыйутреннийпакет docs43. ВопросыАУДQ1/Q2 docs15. Все5bugs localonly, productionuntouched. Следующее:lostACKсозданияпрочих4форм, catalogdecline/unpublish,planlinks/steps,discussionnetwork/double,проверитьвсепробелы77карты. ЕстьподозрениянаduplicateпослеPOSTsuccess+lostresponse в lessons/materials/groups/workspaces (кодбезrequestkey), пока не воспроизведены.

## Продолжение 24.09 — AUD006 и новый регресс (актуальнее предыдущих)
- Локальный commit f7f3b92: AUD001–005 +71 browsertests, docs; push/deploy не было. docs/QA_INDEPENDENT.md чужой, не трогать/stage.
- AUD006 uncommitted:4 создающих формы дублировались после потерянного ACK. Исправлены CreateInput.client_id, helper create_resource_id, endpoints groups/lessons/materials/workspaces +client UUID. tests/test_resource_retry.py8passed; mutation script все8ловит; audit-create-ack4before failed4after passed. Backend164passed. build index-ieHKzHPI.js.
- Audit server session45438/PID9342 на8017. Текущий общий browser session86870, checkpoint-78.json/traces,78tests (новый plan-edit ещё не запускался отдельно). Один worker, synthetic only. Не запускать второйbrowser одновременно.
- catalog-discussion2passed: pricefilters/decline/unpublish/lostACK retry и discussionempty/longUnicode/lostACK/reload/2tabs. Карта77обновлена частично этими фактами и ui-round12.
- Следующее: дождаться78regression; исправить найденное, записать точные результаты, секретскан до локальногокоммита. Непроверенные строки остаются в карте, полную задачу не объявлять завершённой.

## Новейшее: AUD007/008, ещё НЕ коммит
- checkpoint-78:77passed1failed4.9мин. work-status helper index=-1 до прихода опций; choose теперь expect.poll(optionIndex), не force. Plan-edit прошёл; картаU025 обновлена.
- AUD007 confirmed обе роли: delayedSasha response послевыбораЖени заменяетprogress уtutor/guardian. race-strict-before2failed; MutationObserverловиткраткийпоказ, предыдущиймягкийassertродителя былfalsegreenиз-заpoll5s.
- AUD008 retryUI показываетoldfailure/retryпокаqueued. retry-submitbeforefailed. UIисправлен статусом queued/processing иguardawaiting_review.
- Build index-Cavom3tr.js. Текущийrunner session16169 race-retry-after:race2/retry1/workstatus/guardian. Serverбезизменения45438.
- Требуютсяmutation proofs AUD007/008, итоговыеtests/docs/scan+commit. Секретscan16605passed до новыхUIправок, передcommitповторить. 新tests untracked audit-selection-race/retry-submit/catalog-discussion/plan-edit/create-ack; scripts/test_resource_retry_mutations.py. AUD0068mutationscaught.

## Самая новая точка — общий81 регресс
- race-retry-after5passed58.5с; work-statushelper исправлен иpassed. AUD007tutor+guardian/AUD008retry mutation3expectedfailed(16.1/0.7/1.6s). Мутантbuild отдельнов /tmp черезscripts/build_audit_ui_mutant.py;fixtureподменяетJS толькоеслиE2E_MUTATION_ASSET. Обычнаяdistнеизменялась.
- Сейчас browser session8952:checkpoint-81.json/traces,81tests; server45438/PID9342. Не запускать второйbrowser параллельно. Source main.tsx очищен отнесвязанныхprettierdiff, семантикатаже.
- 8продуктовыхдефектов локальноисправлены, всеred/green/mutation. Backend164passed(послеAUD006), AUD007/8толькоUI, buildpassed. Новыйсекретscanпередcommitобязателен;ещёнетвторогокоммита.
- КартаU020/U022/U061обновлена. СценарийU030уточнён: UIменяетстатус/оплату, поляназвание/времяредактироватьнельзя;неизобретатьпуть.

checkpoint-81 завершён:81passed4.7мин. Следующий runner — schedule-files-policy:4 новыхUIтеста (календарь/отмена/файлы/2политикипodсказок). Пока не заявлятьихpassed.

Все4schedule-files-policypassed14.5с. Теперь85browserтестов:81общийgreen+4таргетныхgreen. Карта51/77confirmed,26partial. Новыхдефектоввэтомпрогоненет. Browserпроцессовнет,server45438остаётся.
