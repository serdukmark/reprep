# RePrep: публичное развёртывание 22.09.2026

**URL MiniApp: https://reprep.2-26-49-28.nip.io/**

## Развёрнуто и проверено

- Личная VM 2.26.49.28, новый Docker/Compose из Ubuntu packages: Docker 29.1.3, Compose 2.40.3. Общие приложения не переустанавливались.
- Release `/opt/reprep/releases/20260922-000949`, активная ссылка `/opt/reprep/current`. Compose project `reprep`, контейнер `reprep-app-1`, отдельный volume `reprep_data`. Свежая база; локальная демо-база не переносилась.
- **RePrep занимает только 127.0.0.1:8030.** Порт 8020 оказался занят соседней службой, 8010 используется «Диалогом»; оба сохранены. Порты **80/443 принадлежат общему Caddy**, RePrep добавляет только virtual host и `/etc/caddy/reprep.caddy`, импортированный в существующий Caddyfile. Ассистенту и GEO нужен собственный backend-порт и отдельный site в этом Caddy, а не второй listener 80/443.
- Выполнена команда `scripts/deploy_vm.py --apply`: сборка клиента/сервера, MAX identity, production, healthcheck, Caddy validate/reload, HTTPS probes, регистрация и read-back подписки. Первая попытка дошла до образа, но остановилась до запуска контейнера; повтор с ранее проверенным CA bundle прошёл. CA подключён только к MAX-клиенту; системное доверие не менялось.
- С Mac: `curl` на `/api/ready` → HTTP 200, `ssl_verify_result=0`; HTTPX проверяет TLS без отключения верификации. После перезапуска Docker повторены 9 публичных проверок: ready/HTML/JS/CSP → PASS, анонимный /me → 401, demo → 404, поддельные MAX login и webhook → 401, /.env → 404.
- Настоящий MAX API: GET /me, POST /subscriptions, GET /subscriptions; URL `/api/max/webhook`, типы bot_started/message_created. Серверная предполётная команда подтвердила bot ID и сохранённую подписку. Секреты и ответы API целиком не выводились.
- Чужие службы dialog/dialog-asr/caddy остались active; внешний health «Диалога» до и после выкатки → HTTP 200. Никакие чужие подписки MAX не удалялись.

## Автозапуск: доказательства и предел

Docker и Caddy — enabled. У контейнера restart=unless-stopped. Проверено, что в Docker запущен только RePrep, затем перезапущен Docker daemon: контейнер автоматически поднялся и снова healthy. StartedAt изменился с `2026-09-22T00:10:11.702284746Z` на `2026-09-22T00:11:23.245168802Z`; повторные внешние проверки прошли.

Полную VM после установки RePrep не перезагружали, чтобы не прерывать чужие сервисы. Недавняя перезагрузка владельцем доказала подъём существовавших Caddy/dialog/dialog-asr; RePrep тогда ещё не был установлен. Для него фактически проверен перезапуск Docker, а автозапуск при загрузке ОС обеспечен enabled Docker + restart policy. Не выдаём это за выполненный reboot-тест RePrep.

## Что остаётся

Вставить URL MiniApp в кабинет бота. Реальный вход пользователя внутри MAX, доставка события от пользователя и учебный цикл двух MAX-аккаунтов не проверялись. Предполётный тест и регистрация подписки этого не заменяют. DEMO_ENABLED=false, AI_SYNTHETIC_ONLY=true; прежняя граница допустимых данных для реальных аккаунтов сохранена.

Адрес стабильный при сохранении IP VM, DNS зависит от nip.io. При смене IP понадобится смена адреса или собственный домен. Caddy управляет сертификатом автоматически.

## Управление

Локально повторная выкатка: `.venv/bin/python scripts/deploy_vm.py --apply`.
На VM проверка: `docker exec reprep-app-1 python -m apps.server.deployment preflight`.
Снаружи: `.venv/bin/python scripts/check_public.py --url https://reprep.2-26-49-28.nip.io --human`.
Остановка только RePrep: `docker stop reprep-app-1`. Не выполнять down -v: там база.

Инструкция и ограничения отката: [35_DEPLOY_ONE_COMMAND_RU.md](35_DEPLOY_ONE_COMMAND_RU.md).

## Повторная проверка по следующему сообщению владельца

SSH, Docker/Compose, healthy, restart policy, enabled Docker/Caddy и сохранённая подписка MAX повторно подтверждены. Общий Caddy сохранил import RePrep. Повторная выкатка неизменённого приложения не выполнялась.

Обычный DNS-запрос с Mac на этот раз завис: curl сообщил Resolving timed out. Публичный DNS 1.1.1.1 вернул 2.26.49.28. Прямой внешний HTTPS с `curl --resolve` сохранил проверку имени/TLS: HTTP 200, ssl_verify_result=0. Все 9 внешних проверок также прошли с подстановкой IP только в resolver диагностического процесса, без изменения Host/SNI и без отключения TLS. Настройки сети/hosts не менялись. Это подтверждает исправность стенда и публичной DNS-записи, но не исправность текущего системного DNS на Mac. Зависший первоначальный probe остановлен.
