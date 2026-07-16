/// Адрес панели (бэкенда). Переопределяется при сборке:
///   flutter run --dart-define=API_BASE=https://panel.example.com
///
/// По умолчанию — loopback хоста для эмулятора Android (10.0.2.2 = localhost
/// машины разработчика). Для iOS-симулятора замените на http://localhost:3000.
const String kApiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'http://10.0.2.2:3000',
);

/// Идентификатор bundle для VPN-расширения на iOS (NetworkExtension).
/// Должен совпадать с настроенным в Xcode target'ом packet tunnel.
const String kIosProviderBundleId = 'com.yanivpn.app.tunnel';
