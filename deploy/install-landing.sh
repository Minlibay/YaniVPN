#!/usr/bin/env bash
# Установка лендинга YaniVPN на VPS: nginx + отдельный порт + домен с HTTPS.
#
# Запускать из корня склонированного репозитория под root:
#   sudo bash deploy/install-landing.sh [DOMAIN] [PORT] [EMAIL]
#
# DOMAIN — домен лендинга (по умолчанию yanivpn.space). A-записи домена
#          (@ и www) должны указывать на IP этого VPS до запуска, иначе
#          сертификат не выпустится (сайт при этом останется доступен по HTTP).
# PORT   — отдельный HTTP-порт лендинга (по умолчанию 8080), чтобы он жил
#          рядом с панелью (:3000) и был доступен по http://<IP>:PORT.
# EMAIL  — почта для Let's Encrypt (по умолчанию admin@DOMAIN).

set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
export NEEDRESTART_SUSPEND=1

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_DIR"

if [ "$(id -u)" -ne 0 ]; then
  echo "Запустите под root: sudo bash deploy/install-landing.sh" >&2
  exit 1
fi

DOMAIN="${1:-yanivpn.space}"
PORT="${2:-8080}"
EMAIL="${3:-admin@${DOMAIN}}"
WEBROOT="/var/www/yanivpn-landing"
NGINX_CONF="/etc/nginx/sites-available/yanivpn-landing"
PUBLIC_IP="$(curl -fsSL https://api.ipify.org || true)"

echo ">>> DOMAIN=$DOMAIN PORT=$PORT EMAIL=$EMAIL"

echo ">>> [1/5] Пакеты: nginx, certbot, rsync"
apt-get update -y -qq
apt-get install -y -qq nginx certbot rsync curl ca-certificates >/dev/null

echo ">>> [2/5] Файлы лендинга -> $WEBROOT"
mkdir -p "$WEBROOT"
rsync -a --delete "$REPO_DIR/landing/" "$WEBROOT/"
chown -R www-data:www-data "$WEBROOT"

# Общая часть server-блока (статика)
STATIC_BLOCK=$(cat <<EOF
    root $WEBROOT;
    index index.html;

    gzip on;
    gzip_types text/html text/css application/javascript image/svg+xml;

    location /.well-known/acme-challenge/ {
        root $WEBROOT;
    }

    location ~* \.(png|jpg|jpeg|webp|svg|ico|woff2?)\$ {
        expires 7d;
        add_header Cache-Control "public";
        try_files \$uri =404;
    }

    location / {
        try_files \$uri \$uri/ =404;
    }
EOF
)

write_http_only_conf() {
  cat > "$NGINX_CONF" <<EOF
# Лендинг YaniVPN (автогенерация: deploy/install-landing.sh)

# Отдельный порт — всегда доступен по http://<IP>:$PORT
server {
    listen $PORT;
    listen [::]:$PORT;
    server_name _;
$STATIC_BLOCK
}

# Домен по HTTP (до выпуска сертификата)
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
$STATIC_BLOCK
}
EOF
}

write_https_conf() {
  local CERT_DOMAIN="$1"
  cat > "$NGINX_CONF" <<EOF
# Лендинг YaniVPN (автогенерация: deploy/install-landing.sh)

# Отдельный порт — всегда доступен по http://<IP>:$PORT
server {
    listen $PORT;
    listen [::]:$PORT;
    server_name _;
$STATIC_BLOCK
}

# HTTP -> HTTPS (ACME-челленджи по-прежнему отдаём по HTTP)
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;

    location /.well-known/acme-challenge/ {
        root $WEBROOT;
    }

    location / {
        return 301 https://\$host\$request_uri;
    }
}

# Основной сайт: https://$DOMAIN
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name $DOMAIN www.$DOMAIN;

    ssl_certificate     /etc/letsencrypt/live/$CERT_DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$CERT_DOMAIN/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    add_header Strict-Transport-Security "max-age=31536000" always;
$STATIC_BLOCK
}
EOF
}

echo ">>> [3/5] nginx: HTTP-конфигурация"
write_http_only_conf
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/yanivpn-landing
nginx -t
systemctl enable nginx >/dev/null 2>&1 || true
systemctl reload nginx || systemctl restart nginx

echo ">>> [4/5] Сертификат Let's Encrypt"
HTTPS_OK=0
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
  echo "    Сертификат для $DOMAIN уже есть — пропускаю выпуск."
  HTTPS_OK=1
elif certbot certonly --webroot -w "$WEBROOT" \
      -d "$DOMAIN" -d "www.$DOMAIN" \
      --non-interactive --agree-tos -m "$EMAIL" \
      --deploy-hook "systemctl reload nginx"; then
  HTTPS_OK=1
elif certbot certonly --webroot -w "$WEBROOT" \
      -d "$DOMAIN" \
      --non-interactive --agree-tos -m "$EMAIL" \
      --deploy-hook "systemctl reload nginx"; then
  echo "    ! www.$DOMAIN не прошёл проверку (нет A-записи?) — сертификат выпущен только для $DOMAIN."
  HTTPS_OK=1
else
  echo "    ! Не удалось выпустить сертификат. Проверьте, что A-записи $DOMAIN (и www)"
  echo "      указывают на $PUBLIC_IP, и запустите скрипт ещё раз."
fi

if [ "$HTTPS_OK" = "1" ]; then
  write_https_conf "$DOMAIN"
  nginx -t
  systemctl reload nginx
fi

echo ">>> [5/5] Firewall (ufw)"
ufw allow 80/tcp   >/dev/null 2>&1 || true
ufw allow 443/tcp  >/dev/null 2>&1 || true
ufw allow "$PORT"/tcp >/dev/null 2>&1 || true

echo
echo "================================================================"
echo " Лендинг на отдельном порту:  http://${PUBLIC_IP}:${PORT}"
if [ "$HTTPS_OK" = "1" ]; then
  echo " Лендинг на домене:           https://${DOMAIN}"
  echo " Продление сертификата:       автоматически (systemd-таймер certbot)"
else
  echo " Лендинг на домене:           http://${DOMAIN} (HTTPS пока не настроен)"
fi
echo " Конфиг nginx:                $NGINX_CONF"
echo " Обновление после git pull:   sudo bash deploy/install-landing.sh $DOMAIN $PORT"
echo "================================================================"
