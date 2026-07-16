#!/usr/bin/env bash
# Установка панели YaniVPN на чистый Ubuntu/Debian VPS (HTTP по IP).
#
# Запускать из корня склонированного репозитория под root:
#   sudo bash deploy/install.sh [PANEL_URL]
#
# PANEL_URL — публичный адрес панели, который прописывается агентам нод.
# По умолчанию http://<внешний IP>:3000.

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
# Отключаем интерактивный needrestart (иначе apt зависает на диалоге)
export NEEDRESTART_MODE=a
export NEEDRESTART_SUSPEND=1

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите под root: sudo bash deploy/install.sh" >&2
  exit 1
fi

PUBLIC_IP="$(curl -fsSL https://api.ipify.org || true)"
PANEL_URL="${1:-http://${PUBLIC_IP}:3000}"
echo ">>> PANEL_URL = $PANEL_URL"

echo ">>> [1/6] Пакеты и Node.js 20"
apt-get update -y -qq
apt-get install -y -qq git openssl ufw curl ca-certificates build-essential >/dev/null
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | sed 's/v\([0-9]*\).*/\1/')" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null
  apt-get install -y -qq nodejs >/dev/null
fi
echo "    node $(node -v), npm $(npm -v)"

echo ">>> [2/6] Зависимости"
npm ci

echo ">>> [3/6] Конфигурация (.env)"
if [ ! -f .env ]; then
  ADMIN_PASS="$(openssl rand -hex 6)"
  cat > .env <<EOF
DATABASE_URL="file:./prod.db"
AUTH_SECRET="$(openssl rand -hex 32)"
PANEL_URL="$PANEL_URL"
ADMIN_EMAIL="admin@yanivpn.local"
ADMIN_PASSWORD="$ADMIN_PASS"
EOF
  echo "    .env создан. Пароль администратора: $ADMIN_PASS"
else
  echo "    .env уже есть — оставляю как есть."
fi

# Экспортируем переменные для prisma/seed в этом запуске
set -a; . ./.env; set +a

echo ">>> [4/6] База данных и сборка"
npx prisma db push
npm run db:seed          # только администратор (без демо-серверов)
npm run build

echo ">>> [5/6] systemd-сервис"
install -m 644 deploy/yanivpn-panel.service /etc/systemd/system/yanivpn-panel.service
sed -i "s#__WORKDIR__#$REPO_DIR#g" /etc/systemd/system/yanivpn-panel.service
systemctl daemon-reload
systemctl enable yanivpn-panel >/dev/null 2>&1
systemctl restart yanivpn-panel

echo ">>> [6/6] Firewall (ufw)"
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 3000/tcp >/dev/null 2>&1 || true
ufw --force enable >/dev/null 2>&1 || true

sleep 2
echo
echo "================================================================"
echo " Панель запущена:  $PANEL_URL"
echo " Логин админа:     см. ADMIN_EMAIL / ADMIN_PASSWORD в $REPO_DIR/.env"
echo " Статус сервиса:   systemctl status yanivpn-panel"
echo " Логи:             journalctl -u yanivpn-panel -f"
echo "================================================================"
