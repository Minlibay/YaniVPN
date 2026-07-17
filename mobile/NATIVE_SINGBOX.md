# Встроенный туннель обхода (sing-box) — нативная интеграция

Dart-слой готов полностью: [`lib/services/singbox_service.dart`](lib/services/singbox_service.dart)
парсит `vless://`, собирает конфиг sing-box и общается с нативной частью через
каналы. Пока нативной реализации нет — приложение это определяет через
`isAvailable()` и корректно откатывается к показу ссылки для импорта. Ничего
не ломается; нужно лишь «подключить провод» на каждой платформе.

## Контракт каналов

MethodChannel `com.yanivpn/singbox`:

| method | аргументы | результат | действие |
|--------|-----------|-----------|----------|
| `isAvailable` | — | `bool` | есть ли рабочий движок в этой сборке |
| `start` | `{config: String}` | — | запустить туннель по JSON-конфигу sing-box |
| `stop` | — | — | остановить туннель |

EventChannel `com.yanivpn/singbox/status` — поток строк:
`connecting` → `connected` → `disconnected` (или `error`).

`config` — это готовый JSON sing-box (schema 1.8+) с `tun`-inbound
(`auto_route`, `strict_route`) и DNS через прокси-выход: захват всего трафика и
защита от DNS-утечек уже заложены в конфиг.

## Android

1. Подключить `libbox` (Go-биндинг sing-box) как `.aar`:
   собрать из `github.com/SagerNet/sing-box` через `gomobile bind -target android`
   (пакет `github.com/sagernet/sing-box/experimental/libbox`), либо взять готовый
   `libbox.aar` из релизов SFA (sing-box for Android).
2. Реализовать `VpnService` (Android) + `MethodChannel`/`EventChannel` в
   `MainActivity`/плагине. `start`: поднять `VpnService`, отдать fd в
   `libbox.NewService(config, platformInterface)`; статус слать в EventChannel.
3. Разрешения/манифест: `android.permission.FOREGROUND_SERVICE`,
   `<service ... android:permission="android.permission.BIND_VPN_SERVICE">`.

## iOS

1. Добавить Network Extension target (Packet Tunnel), bundle id = `kIosProviderBundleId`.
2. Встроить `Libbox.xcframework` (тот же `gomobile bind -target ios`).
3. В `PacketTunnelProvider` поднимать sing-box из переданного config; мост к
   Dart — через `MethodChannel` в основном приложении, управление туннелем — через
   `NETunnelProviderManager`.

## Проверка

После интеграции `isAvailable()` вернёт `true`, и VLESS-сервер в приложении
будет подниматься как настоящий туннель (кнопка «Подключить»/«Авто-подключение»),
а не отдаваться ссылкой. Fallback на ссылку останется на платформах/сборках без
движка.
