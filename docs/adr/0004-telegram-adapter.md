# Telegram adapter — 2026-09-23

[CONFIRMED] Владелец поручил подключить и развернуть @MaxFuckYouBot, настроил Main App URL. MAX остаётся основным каналом кейса.

Один backend и учебный сценарий, два адаптера авторизации и доставки. Telegram проверяет initData серверным HMAC WebAppData, срок 5 минут, повторяющиеся параметры запрещены. Поле signature входит в строку HMAC. Внешний ID хранится как telegram:<id>; числовые MAX ID не объединяются автоматически. Роль существующего пользователя нельзя менять повторным входом. Сессии клиента раздельные; platform=telegram сохраняется после удаления initData из адреса для перезагрузки.

Webhook защищён отдельным производным secret_token, принимаются личные /start, /help, /app; повторные update_id не создают новые ответы. Очередь и opt-in напоминания разделены префиксом канала. Токен только TELEGRAM_BOT_TOKEN в закрытом .env. TELEGRAM_BOT_ENABLED включает канал. Deploy регистрирует webhook, меню MiniApp и читает подписку обратно. HTTP ошибки и журналы не раскрывают URL с токеном.

Реальные пользовательские данные не получают новое разрешение на внешний AI. Синтетический режим и ограничения родительского кабинета сохранены. Автоматического связывания аккаунтов MAX/Telegram нет.

Источники: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app и https://core.telegram.org/bots/api#setwebhook.

Проверки: tests/test_telegram.py, весь tests/, npm run build. Реальный запуск интерфейса человеком в Telegram отмечается отдельно от API-проверок.
