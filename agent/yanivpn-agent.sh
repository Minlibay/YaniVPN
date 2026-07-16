#!/usr/bin/env bash
# Агент YaniVPN для VPN-ноды.
# Раз в минуту собирает статистику текущего протокола и отправляет в панель.
# В ответ панель присылает список включённых клиентов — агент синхронизирует
# конфигурацию (добавляет новых, убирает удалённых/отключённых).
#
# Настройка (переменные окружения или /etc/yanivpn-agent.env):
#   PANEL_URL    — адрес панели, например https://panel.example.com
#   API_TOKEN    — токен сервера из панели
#   PROTOCOL     — wireguard | vless (по умолчанию wireguard)
# WireGuard:
#   WG_IFACE     — интерфейс (по умолчанию wg0)
# VLESS (Xray):
#   XRAY_CONFIG  — путь к config.json (по умолчанию /usr/local/etc/xray/config.json)
#   XRAY_API     — адрес stats API (по умолчанию 127.0.0.1:10085)
#
# Зависимости: bash, curl, jq; wg (WireGuard) или xray (VLESS).

set -euo pipefail

[ -f /etc/yanivpn-agent.env ] && . /etc/yanivpn-agent.env

PANEL_URL="${PANEL_URL:?PANEL_URL не задан}"
API_TOKEN="${API_TOKEN:?API_TOKEN не задан}"
PROTOCOL="${PROTOCOL:-wireguard}"
WG_IFACE="${WG_IFACE:-wg0}"
XRAY_CONFIG="${XRAY_CONFIG:-/usr/local/etc/xray/config.json}"
XRAY_API="${XRAY_API:-127.0.0.1:10085}"
# Интервал отчёта/синхронизации в секундах (для теста можно уменьшить)
INTERVAL="${INTERVAL:-60}"

# --- WireGuard -------------------------------------------------------------

wg_collect() {
  # `wg show <iface> dump`: строки пиров — pubkey psk endpoint allowed-ips
  # latest-handshake rx tx keepalive. id = публичный ключ.
  wg show "$WG_IFACE" dump | tail -n +2 | jq -R -s '
    [ split("\n")[] | select(length > 0) | split("\t")
      | { id: .[0], latestHandshake: (.[4]|tonumber), rxBytes: (.[5]|tonumber), txBytes: (.[6]|tonumber) } ]'
}

wg_sync() {
  # $1 — JSON-ответ панели { peers: [{publicKey, allowedIp}] }
  local response="$1"
  echo "$response" | jq -r '.peers[] | select(.publicKey != null) | "\(.publicKey) \(.allowedIp)"' |
    while read -r pubkey allowed_ip; do
      wg set "$WG_IFACE" peer "$pubkey" allowed-ips "$allowed_ip"
    done
  local known
  known=$(echo "$response" | jq -r '.peers[].publicKey // empty')
  wg show "$WG_IFACE" peers | while read -r pubkey; do
    grep -qF "$pubkey" <<<"$known" || wg set "$WG_IFACE" peer "$pubkey" remove
  done
}

# --- VLESS (Xray) ----------------------------------------------------------

vless_collect() {
  # Статистика по пользователям из Xray API. Клиенты помечены email = UUID.
  # uplink = принято от клиента (rx), downlink = отправлено клиенту (tx).
  local stats
  stats=$(xray api statsquery --server="$XRAY_API" 2>/dev/null || echo '{}')
  echo "$stats" | jq -c '
    [ (.stat // [])
      | map(select(.name | startswith("user>>>")))
      | group_by(.name | split(">>>")[1])
      | .[]
      | { id: (.[0].name | split(">>>")[1]),
          rxBytes: ([.[] | select(.name | endswith(">>>uplink"))   | (.value // "0" | tonumber)] | add // 0),
          txBytes: ([.[] | select(.name | endswith(">>>downlink")) | (.value // "0" | tonumber)] | add // 0) } ]'
}

vless_sync() {
  # $1 — JSON-ответ панели { peers: [{uuid}] }. Переписываем clients только
  # при изменении набора и перезапускаем Xray (иначе не трогаем — счётчики целы).
  local response="$1"
  local desired current
  desired=$(echo "$response" | jq -c '
    [ .peers[] | select(.uuid != null)
      | { id: .uuid, email: .uuid, flow: "xtls-rprx-vision" } ]')
  current=$(jq -c '(.inbounds[] | select(.tag=="vless-in") | .settings.clients) // []' "$XRAY_CONFIG")

  if [ "$desired" != "$current" ]; then
    local tmp
    tmp=$(mktemp)
    jq --argjson clients "$desired" \
      '(.inbounds[] | select(.tag=="vless-in") | .settings.clients) |= $clients' \
      "$XRAY_CONFIG" > "$tmp" && mv "$tmp" "$XRAY_CONFIG"
    systemctl restart xray
  fi
}

# --- Общий цикл ------------------------------------------------------------

report() {
  local peers_json="$1"
  curl -sS --fail --max-time 15 \
    -H "Authorization: Bearer $API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"peers\":$peers_json}" \
    "$PANEL_URL/api/agent/report"
}

main() {
  while true; do
    if [ "$PROTOCOL" = "vless" ]; then
      peers_json=$(vless_collect)
    else
      peers_json=$(wg_collect)
    fi

    if response=$(report "$peers_json"); then
      if [ "$PROTOCOL" = "vless" ]; then
        vless_sync "$response" || echo "[yanivpn-agent] ошибка синхронизации Xray" >&2
      else
        wg_sync "$response" || echo "[yanivpn-agent] ошибка синхронизации WireGuard" >&2
      fi
    else
      echo "[yanivpn-agent] панель недоступна, повтор позже" >&2
    fi
    sleep "$INTERVAL"
  done
}

main
