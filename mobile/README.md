# YaniVPN — мобильное приложение (Flutter)

Клиент YaniVPN для iOS и Android. Без регистрации: при первом запуске
приложение получает **конфигурационный код** и работает по нему. Код можно
перенести на другое устройство и продолжить пользоваться VPN с тем же трафиком.

## Возможности

- **Без регистрации** — аккаунт создаётся автоматически, в настройках виден
  личный код (текст + QR). Ввод кода на другом устройстве переносит аккаунт.
- **Список серверов и подключение** — сервера тянутся из панели
  (`/api/app/servers`), кнопка «Подключить» поднимает туннель.
- **Лимит 2 ГБ** — индикатор трафика; при исчерпании показывается экран покупки
  доступа (paywall), а подключение блокируется (сервер возвращает `402`).
- **WireGuard** туннелируется в приложении (пара ключей генерируется на
  устройстве, приватный ключ его не покидает). **VLESS** пока отдаётся ссылкой
  `vless://…` для импорта во внешнее приложение — встроенный туннель на Xray-core
  в планах.

## Архитектура

```
lib/
  main.dart              точка входа, тема, провайдер состояния
  config.dart            адрес бэкенда (--dart-define=API_BASE=...)
  api/api_client.dart    клиент /api/app/* (Bearer = код аккаунта)
  models/                Account, ServerInfo
  state/app_state.dart   ChangeNotifier: аккаунт, серверы, статус VPN
  services/
    vpn_service.dart     обёртка над wireguard_flutter (системный VPN)
    wireguard_keys.dart  генерация/хранение ключей WireGuard (X25519)
  screens/               home, settings, paywall
  widgets/               usage_bar, server_tile
```

Бэкенд (эндпоинты для приложения): `src/app/api/app/*` в корне репозитория —
`register`, `session`, `servers`, `connect`, `usage`, `upgrade`.

## Запуск (разработка)

Платформенные папки (`android/`, `ios/`) не хранятся в репозитории — создайте их:

```bash
cd mobile
flutter create .            # генерирует android/ и ios/ вокруг lib/
flutter pub get
# API_BASE: для эмулятора Android хост доступен как 10.0.2.2
flutter run --dart-define=API_BASE=http://10.0.2.2:3000
```

Панель (бэкенд) должна быть запущена и доступна с устройства/эмулятора.
Для реального устройства укажите публичный `API_BASE` (домен панели по HTTPS).

## Настройка системного VPN

`wireguard_flutter` использует системные VPN-механизмы — после `flutter create`
нужно один раз донастроить платформы:

**Android** (`android/app/src/main/AndroidManifest.xml`): плагин добавляет
`BIND_VPN_SERVICE` сам; убедитесь, что `minSdkVersion >= 21` в
`android/app/build.gradle`.

**iOS**: в Xcode добавьте у основного таргета capability **Network Extensions**
(Packet Tunnel) и создайте Network Extension target с bundle id, совпадающим с
`kIosProviderBundleId` в `lib/config.dart` (`com.yanivpn.app.tunnel`). Оба таргета
должны входить в одну App Group. Подробнее — в документации `wireguard_flutter`.

## Оплата

Экран paywall вызывает `POST /api/app/upgrade`. Сейчас это **заглушка**: на
бэкенде она включается только при `ALLOW_MOCK_PURCHASE=1` (для разработки) и не
проверяет чек. Перед релизом встройте In-App Purchase (StoreKit / Google Play
Billing) и серверную валидацию чека в `upgrade`.
