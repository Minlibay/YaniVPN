import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../models/account.dart';
import '../models/server_info.dart';
import '../services/vpn_service.dart';
import '../services/wireguard_keys.dart';

enum AppPhase { loading, ready, error }

/// Единый источник состояния: аккаунт, список серверов, статус VPN.
class AppState extends ChangeNotifier {
  AppState({ApiClient? api, VpnService? vpn})
      : _api = api ?? ApiClient(),
        _vpn = vpn ?? VpnService() {
    _statusSub = _vpn.statusStream().listen((s) {
      _vpnStatus = s;
      if (s == VpnStatus.disconnected) _activeServerId = null;
      notifyListeners();
    });
  }

  static const _codePref = 'account_code';

  final ApiClient _api;
  final VpnService _vpn;
  StreamSubscription<VpnStatus>? _statusSub;

  AppPhase phase = AppPhase.loading;
  String? errorMessage;
  Account? account;
  List<ServerInfo> servers = [];

  VpnStatus _vpnStatus = VpnStatus.disconnected;
  VpnStatus get vpnStatus => _vpnStatus;

  String? _activeServerId;
  String? get activeServerId => _activeServerId;

  // Сервер, выбранный для подключения большой кнопкой на главном экране.
  String? _selectedServerId;
  ServerInfo? get selectedServer {
    for (final s in servers) {
      if (s.id == _selectedServerId) return s;
    }
    return null;
  }

  void selectServer(ServerInfo server) {
    _selectedServerId = server.id;
    notifyListeners();
  }

  // Последняя VLESS-ссылка для импорта (когда встроенного туннеля ещё нет).
  String? vlessLinkForImport;

  // Готовый .conf WireGuard для показа (веб-версия — системного VPN в браузере
  // нет, туннель не поднять, поэтому конфиг отдаётся для проверки/импорта).
  String? wireguardConfigForImport;

  /// Старт: восстанавливаем код из хранилища или регистрируем новый аккаунт.
  Future<void> init() async {
    phase = AppPhase.loading;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_codePref);
      account = saved != null ? await _api.session(saved) : await _register(prefs);
      await refreshServers();
      phase = AppPhase.ready;
    } catch (e) {
      // Если сохранённый код больше не валиден — заводим новый.
      if (e is ApiException && e.statusCode == 404) {
        try {
          final prefs = await SharedPreferences.getInstance();
          account = await _register(prefs);
          await refreshServers();
          phase = AppPhase.ready;
        } catch (e2) {
          _fail(e2);
        }
      } else {
        _fail(e);
      }
    }
    notifyListeners();
  }

  Future<Account> _register(SharedPreferences prefs) async {
    final acc = await _api.register();
    await prefs.setString(_codePref, acc.code);
    return acc;
  }

  void _fail(Object e) {
    phase = AppPhase.error;
    errorMessage = e.toString();
  }

  Future<void> refreshServers() async {
    if (account == null) return;
    servers = await _api.servers(account!.code);
    // Выбор по умолчанию: первый онлайн-сервер (или первый в списке).
    if (selectedServer == null && servers.isNotEmpty) {
      _selectedServerId = servers
          .firstWhere((s) => s.online, orElse: () => servers.first)
          .id;
    }
    notifyListeners();
  }

  Future<void> refreshUsage() async {
    if (account == null) return;
    account = await _api.usage(account!.code);
    notifyListeners();
  }

  /// Восстановление аккаунта по коду с другого устройства.
  Future<void> restoreWithCode(String code) async {
    final acc = await _api.session(code.trim());
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_codePref, acc.code);
    account = acc;
    await refreshServers();
    notifyListeners();
  }

  bool get isConnected => _vpnStatus == VpnStatus.connected;
  bool get isBusy =>
      _vpnStatus == VpnStatus.connecting;

  /// Подключение к серверу. Бросает ApiException (в т.ч. 402 — квота).
  /// Возвращает true, если поднят туннель; false — если это VLESS-ссылка
  /// для импорта (встроенный туннель пока не поддержан).
  Future<bool> connect(ServerInfo server) async {
    if (account == null) return false;
    vlessLinkForImport = null;
    wireguardConfigForImport = null;

    if (server.isVless) {
      final res = await _api.connect(account!.code, server.id);
      vlessLinkForImport = res.link;
      notifyListeners();
      return false;
    }

    final keys = await WireguardKeys.forServer(server.id);
    final res = await _api.connect(
      account!.code,
      server.id,
      clientPublicKey: keys.publicKey,
    );
    final conf = res.configTemplate!.replaceFirst('%PRIVATE_KEY%', keys.privateKey);

    // В браузере системного VPN нет — отдаём конфиг для проверки/импорта.
    if (kIsWeb) {
      wireguardConfigForImport = conf;
      notifyListeners();
      return false;
    }

    _vpnStatus = VpnStatus.connecting;
    _activeServerId = server.id;
    notifyListeners();
    await _vpn.connectWireguard(conf, server.id);
    // статус «connected» придёт из statusStream
    return true;
  }

  Future<void> disconnect() async {
    await _vpn.disconnect();
    _activeServerId = null;
    _vpnStatus = VpnStatus.disconnected;
    notifyListeners();
  }

  /// Заглушка покупки: на бэкенде включается только в dev (ALLOW_MOCK_PURCHASE).
  Future<void> upgrade() async {
    if (account == null) return;
    account = await _api.upgrade(account!.code, 'mock-receipt', _platform());
    notifyListeners();
  }

  String _platform() => defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';

  @override
  void dispose() {
    _statusSub?.cancel();
    super.dispose();
  }
}
