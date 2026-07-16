#!/usr/bin/env bash
# Агент YaniVPN для VPN-ноды.
# Раз в минуту читает состояние WireGuard и отправляет отчёт в панель.
# Ответ панели содержит список включённых пиров — агент синхронизирует
# конфигурацию интерфейса (добавляет новых клиентов, убирает удалённых).
#
# Настройка (переменные окружения или /etc/yanivpn-agent.env):
#   PANEL_URL   — адрес панели, например https://panel.example.com
#   API_TOKEN   — токен сервера из панели (Серверы → Токен)
#   WG_IFACE    — интерфейс WireGuard (по умолчанию wg0)
#
# Зависимости: bash, curl, jq, wg. Запуск — см. agent/README.md.

set -euo pipefail

[ -f /etc/yanivpn-agent.env ] && . /etc/yanivpn-agent.env

PANEL_URL="${PANEL_URL:?PANEL_URL не задан}"
API_TOKEN="${API_TOKEN:?API_TOKEN не задан}"
WG_IFACE="${WG_IFACE:-wg0}"

report() {
  # `wg show <iface> dump`: первая строка — интерфейс, дальше по пиру на строку:
  # pubkey psk endpoint allowed-ips latest-handshake rx tx keepalive
  local peers_json
  peers_json=$(wg show "$WG_IFACE" dump | tail -n +2 | awk '{
    printf "%s{\"publicKey\":\"%s\",\"latestHandshake\":%s,\"rxBytes\":%s,\"txBytes\":%s}", sep, $1, $5, $6, $7; sep=","
  }')

  curl -sS --fail --max-time 15 \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"peers\":[${peers_json}]}" \
    "$PANEL_URL/api/agent/report"
}

sync_peers() {
  # $1 — JSON-ответ панели: { peers: [{publicKey, allowedIp}] }
  local response="$1"

  # добавляем/обновляем включённые пиры
  echo "$response" | jq -r '.peers[] | "\(.publicKey) \(.allowedIp)"' |
    while read -r pubkey allowed_ip; do
      wg set "$WG_IFACE" peer "$pubkey" allowed-ips "$allowed_ip"
    done

  # убираем пиры, которых панель больше не отдаёт
  local known
  known=$(echo "$response" | jq -r '.peers[].publicKey')
  wg show "$WG_IFACE" peers | while read -r pubkey; do
    if ! grep -qF "$pubkey" <<<"$known"; then
      wg set "$WG_IFACE" peer "$pubkey" remove
    fi
  done
}

main() {
  while true; do
    if response=$(report); then
      sync_peers "$response" || echo "[yanivpn-agent] ошибка синхронизации пиров" >&2
    else
      echo "[yanivpn-agent] панель недоступна, повтор через минуту" >&2
    fi
    sleep 60
  done
}

main
