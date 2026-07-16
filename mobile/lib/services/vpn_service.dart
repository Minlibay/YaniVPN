import 'package:flutter/foundation.dart';
import 'package:wireguard_flutter/wireguard_flutter.dart';

import '../config.dart';

enum VpnStatus { disconnected, connecting, connected, error }

/// Обёртка над системным VPN. Туннель WireGuard поднимается через плагин
/// wireguard_flutter (NetworkExtension на iOS, VpnService на Android).
///
/// На вебе системного VPN нет — плагин не поддерживает web и бросает
/// исключение при любом обращении, поэтому здесь он вообще не трогается
/// (kIsWeb-ветки). Веб-версия служит только для проверки UI и API; конфиг
/// показывается для импорта, туннель — в сборках под телефон.
///
/// VLESS в приложении пока не туннелируется: нужен встроенный Xray-core
/// (mobile). До его интеграции VLESS отдаётся ссылкой vless://… (см. HomeScreen).
class VpnService {
  // На вебе плагин не инстанцируем — обращение к нему падает.
  final _wg = kIsWeb ? null : WireGuardFlutter.instance;
  bool _initialized = false;

  Future<void> _ensureInit() async {
    if (kIsWeb || _initialized) return;
    await _wg!.initialize(interfaceName: 'yanivpn');
    _initialized = true;
  }

  /// Поднимает туннель WireGuard по готовому .conf.
  Future<void> connectWireguard(String wgQuickConfig, String serverAddress) async {
    if (kIsWeb) return;
    await _ensureInit();
    await _wg!.startVpn(
      serverAddress: serverAddress,
      wgQuickConfig: wgQuickConfig,
      providerBundleIdentifier: kIosProviderBundleId,
    );
  }

  Future<void> disconnect() async {
    if (kIsWeb || !_initialized) return;
    await _wg!.stopVpn();
  }

  /// Поток статуса подключения от системного VPN (на вебе — пустой).
  Stream<VpnStatus> statusStream() {
    if (kIsWeb || _wg == null) return const Stream<VpnStatus>.empty();
    return _wg!.vpnStageSnapshot.map((stage) {
      switch (stage) {
        case VpnStage.connected:
          return VpnStatus.connected;
        case VpnStage.connecting:
        case VpnStage.authenticating:
        case VpnStage.reconnect:
        case VpnStage.preparing:
          return VpnStatus.connecting;
        default:
          return VpnStatus.disconnected;
      }
    });
  }
}
