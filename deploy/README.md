# Деплой панели на VPS (HTTP по IP)

Установка панели YaniVPN на отдельный VPS, доступной по `http://<IP>:3000`.
Подходит для теста и первого запуска. Позже легко перевести на домен + HTTPS.

## Установка

На чистом Ubuntu/Debian VPS под root:

```bash
# 1. Забрать код (репозиторий приватный — понадобится доступ к GitHub)
git clone https://github.com/Minlibay/YaniVPN.git /opt/yanivpn
cd /opt/yanivpn

# 2. Установить всё одной командой
sudo bash deploy/install.sh
```

Скрипт сам поставит Node.js 20, зависимости, создаст `.env` со случайными
`AUTH_SECRET` и паролем администратора, инициализирует базу (SQLite `prod.db`),
соберёт проект, поднимет systemd-сервис `yanivpn-panel` и откроет порт 3000 в
`ufw`. В конце он напечатает адрес панели и путь к логину.

По умолчанию `PANEL_URL` = `http://<внешний IP>:3000`. Если нужен другой адрес
(например, другой порт), передайте его аргументом:

```bash
sudo bash deploy/install.sh http://203.0.113.10:3000
```

`PANEL_URL` прописывается агентам нод — по нему они шлют статистику, поэтому он
должен быть публично доступен.

## Проверка

- Откройте `http://<IP>:3000` — форма входа. Логин и пароль — в `/opt/yanivpn/.env`
  (`ADMIN_EMAIL` / `ADMIN_PASSWORD`).
- `systemctl status yanivpn-panel` — сервис активен.
- `journalctl -u yanivpn-panel -f` — логи.

## Управление

```bash
systemctl restart yanivpn-panel     # перезапуск
systemctl stop yanivpn-panel        # остановить
journalctl -u yanivpn-panel -f      # логи
```

Обновление кода:

```bash
cd /opt/yanivpn
git pull
npm ci
npx prisma db push
npm run build
systemctl restart yanivpn-panel
```

## Подключение приложения

Приложение обращается к панели по HTTP на голый IP. Android по умолчанию
блокирует cleartext-HTTP, поэтому для теста включите его: в
`mobile/android/app/src/main/AndroidManifest.xml` в теге `<application …>`
добавьте атрибут:

```xml
<application
    android:label="yanivpn"
    android:usesCleartextTraffic="true"
    ... >
```

Затем запускайте с адресом панели:

```bash
cd mobile
flutter run -d emulator --dart-define=API_BASE=http://<IP>:3000
```

## Важно (безопасность)

Это тестовая конфигурация: **HTTP без шифрования**. Трафик админ-входа и API
приложения идёт открытым текстом. Перед реальным запуском:

- заведите домен, включите HTTPS (например, Caddy + Let’s Encrypt) и уберите
  cleartext из приложения;
- смените пароль администратора;
- ограничьте `/api/app/register` (сейчас любой может создавать аккаунты) —
  rate-limit или капча;
- `ALLOW_MOCK_PURCHASE` на боевой панели **не** включайте.

> Быстрый способ получить HTTPS без своего домена — сервисы вида `nip.io`
> (`<IP>.nip.io` резолвится в ваш IP), под которые Caddy может выпустить
> сертификат Let’s Encrypt. Тогда cleartext в приложении не нужен.
