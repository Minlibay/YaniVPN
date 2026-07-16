import 'package:wireguard_flutter/wireguard_flutter.dart';

import '../config.dart';

enum VpnStatus { disconnected, connecting, connected, error }

/// Обёртка над системным VPN. Сейчас реализован туннель WireGuard через
/// плагин wireguard_flutter (NetworkExtension на iOS, VpnService на Android).
///
/// VLESS в приложении пока не туннелируется: для этого нужен встроенный
/// Xray-core (mobile). До его интеграции VLESS-сервер отдаётся ссылкой
/// vless://… для импорта в совместимое приложение (см. HomeScreen).
class VpnService {
  final _wg = WireGuardFlutter.instance;
  bool _initialized = false;

  Future<void> _ensureInit() async {
    if (_initialized) return;
    await _wg.initialize(interfaceName: 'yanivpn');
    _initialized = true;
  }

  /// Поднимает туннель WireGuard по готовому .conf.
  Future<void> connectWireguard(String wgQuickConfig, String serverAddress) async {
    await _ensureInit();
    await _wg.startVpn(
      serverAddress: serverAddress,
      wgQuickConfig: wgQuickConfig,
      providerBundleIdentifier: kIosProviderBundleId,
    );
  }

  Future<void> disconnect() async {
    if (!_initialized) return;
    await _wg.stopVpn();
  }

  /// Поток статуса подключения от системного VPN.
  Stream<VpnStatus> statusStream() {
    return _wg.vpnStageSnapshot.map((stage) {
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
