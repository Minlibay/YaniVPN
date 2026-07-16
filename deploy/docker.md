# Деплой панели: Docker + PostgreSQL + HTTPS

Продакшен-схема: три контейнера через `docker compose` в корне репозитория.

| Сервис | Что делает |
|--------|-----------|
| `db`    | PostgreSQL 16, данные в volume `db-data` |
| `panel` | Next.js-панель; при старте применяет схему БД и сидит администратора |
| `caddy` | Принимает 80/443, проксирует на панель и **сам выпускает/продлевает сертификат Let's Encrypt** для домена |

## 0. Подготовка DNS

Создайте у DNS-провайдера **A-запись**: `panel.yanivpn.space → <IP сервера>`.
Дождитесь, пока она начнёт резолвиться (`ping panel.yanivpn.space`) — без этого
Let's Encrypt не выдаст сертификат.

## 1. Docker на сервере

```bash
curl -fsSL https://get.docker.com | sh
```

## 2. Код и конфигурация

```bash
git clone https://github.com/Minlibay/YaniVPN.git /opt/yanivpn   # или git pull в существующем
cd /opt/yanivpn

cat > .env <<EOF
DOMAIN="panel.yanivpn.space"
ACME_EMAIL="an.volovod@yandex.ru"
POSTGRES_PASSWORD="$(openssl rand -hex 16)"
AUTH_SECRET="$(openssl rand -hex 32)"
ADMIN_EMAIL="admin@yanivpn.local"
ADMIN_PASSWORD="$(openssl rand -hex 6)"
EOF
chmod 600 .env
cat .env   # сохраните пароль администратора
```

## 3. Firewall

```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw delete allow 3000/tcp 2>/dev/null || true   # старый порт панели больше не нужен
```

## 4. Запуск

```bash
docker compose up -d --build
```

Первая сборка занимает несколько минут. Проверка:

```bash
docker compose ps                # все три сервиса Up (db — healthy)
docker compose logs -f caddy     # строка про obtained certificate = HTTPS готов
docker compose logs -f panel     # "Ready" от Next.js
```

Панель: **https://panel.yanivpn.space** (логин/пароль — из `.env`).

## Переезд со старой установки (systemd + SQLite)

1. Остановите старый сервис, чтобы освободить ресурсы и не путаться:
   ```bash
   systemctl disable --now yanivpn-panel
   ```
2. База начинается с чистого листа (PostgreSQL). Добавьте VPN-серверы заново
   через «Серверы → Добавить сервер» — панель переустановит агента на нодах
   и пропишет им новый адрес `https://panel.yanivpn.space`.
3. Если ноды уже работают и переустанавливать протокол нельзя, достаточно
   на каждой ноде поправить адрес панели и токен:
   ```bash
   nano /etc/yanivpn-agent.env   # PANEL_URL=https://panel.yanivpn.space, API_TOKEN=<из новой панели>
   systemctl restart yanivpn-agent
   ```
4. Мобильное приложение пересоберите с новым адресом:
   ```bash
   flutter build apk --release --dart-define=API_BASE=https://panel.yanivpn.space
   ```
   `usesCleartextTraffic` из AndroidManifest теперь можно убрать — трафик идёт по HTTPS.

## Обслуживание

```bash
docker compose logs -f panel        # логи панели
docker compose restart panel        # перезапуск
docker compose down                 # остановить всё (данные БД сохраняются в volume)
docker compose up -d                # поднять снова

# Обновление кода
git pull && docker compose up -d --build

# Бэкап базы
docker compose exec db pg_dump -U yanivpn yanivpn > backup_$(date +%F).sql
```

Сертификат обновляется автоматически (Caddy проверяет срок каждые сутки),
хранится в volume `caddy-data` и переживает пересоздание контейнеров.
