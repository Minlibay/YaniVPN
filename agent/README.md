# Агент YaniVPN для VPN-ноды

Небольшой скрипт, который работает на каждом VPN-сервере рядом с WireGuard:

- раз в минуту отправляет в панель статистику всех пиров (`wg show <iface> dump`);
- получает в ответ актуальный список включённых клиентов и синхронизирует
  конфигурацию интерфейса — новые клиенты из панели начинают работать,
  удалённые/отключённые теряют доступ.

Благодаря отчётам агента панель показывает статус сервера (онлайн/офлайн),
активные подключения и графики трафика.

## Установка на ноду

1. Поднимите WireGuard-интерфейс (например `wg0`) и добавьте сервер в панели
   (**Серверы → Добавить сервер**, публичный ключ — из `wg show wg0 public-key`).
   При создании панель покажет **токен агента** — сохраните его.

2. Установите зависимости и скопируйте агент:

   ```bash
   apt install -y curl jq
   cp yanivpn-agent.sh /usr/local/bin/yanivpn-agent
   chmod +x /usr/local/bin/yanivpn-agent
   ```

3. Создайте `/etc/yanivpn-agent.env`:

   ```bash
   PANEL_URL=https://panel.example.com
   API_TOKEN=<токен из панели>
   WG_IFACE=wg0
   ```

4. Запустите как systemd-сервис — `/etc/systemd/system/yanivpn-agent.service`:

   ```ini
   [Unit]
   Description=YaniVPN node agent
   After=network-online.target wg-quick@wg0.service

   [Service]
   ExecStart=/usr/local/bin/yanivpn-agent
   Restart=always
   RestartSec=10

   [Install]
   WantedBy=multi-user.target
   ```

   ```bash
   systemctl enable --now yanivpn-agent
   ```

Через минуту сервер в панели станет «онлайн», а по мере подключения клиентов
появятся статистика и графики.

## Протокол

`POST /api/agent/report` с заголовком `Authorization: Bearer <API_TOKEN>`:

```json
{
  "peers": [
    { "publicKey": "…", "latestHandshake": 1720000000, "rxBytes": 123, "txBytes": 456 }
  ]
}
```

Ответ:

```json
{ "ok": true, "peers": [{ "publicKey": "…", "allowedIp": "10.8.0.2/32" }] }
```
