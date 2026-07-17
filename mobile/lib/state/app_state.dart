import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../api/api_client.dart';
import '../models/account.dart';
import '../models/server_info.dart';
import '../services/vpn_service.dart';
import '../services/singbox_service.dart';
import '../services/wireguard_keys.dart';

enum AppPhase { loading, ready, error }

// Какой движок держит активный туннель. WireGuard идёт через wireguard_flutter,
// обходные протоколы (VLESS) — через sing-box.
enum _Engine { none, wireguard, singbox }

/// Единый источник состояния: аккаунт, список серверов, статус VPN.
class AppState extends ChangeNotifier {
  AppState({ApiClient? api, VpnService? vpn, SingboxService? singbox})
      : _api = api ?? ApiClient(),
        _vpn = vpn ?? VpnService(),
        _singbox = singbox ?? SingboxService() {
    _statusSub = _vpn.statusStream().listen((s) => _onStatus(s, _Engine.wireguard));
    _sbSub = _singbox.statusStream().listen((s) => _onStatus(s, _Engine.singbox));
  }

  static const _codePref = 'account_code';
  static const _killPref = 'kill_switch';

  final ApiClient _api;
  final VpnService _vpn;
  final SingboxService _singbox;
  StreamSubscription<VpnStatus>? _statusSub;
  StreamSubscription<VpnStatus>? _sbSub;

  _Engine _engine = _Engine.none;
  bool _userWantsConnected = false; // пользователь нажал «подключить», не «отключить»
  ServerInfo? _desiredServer; // для авто-реконнекта kill-switch
  bool _reconnecting = false;

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

  // Kill-switch: при неожиданном обрыве туннеля не пускаем трафик мимо —
  // держим состояние «переподключение» и авто-восстанавливаем канал.
  bool _killSwitch = false;
  bool get killSwitch => _killSwitch;
  bool get isReconnecting => _reconnecting;

  Future<void> setKillSwitch(bool value) async {
    _killSwitch = value;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_killPref, value);
    notifyListeners();
  }

  // Единый обработчик статуса от обоих движков. События неактивного движка
  // игнорируем, чтобы «disconnected» простаивающего плагина не сбивал туннель.
  void _onStatus(VpnStatus s, _Engine from) {
    if (_engine != _Engine.none && from != _engine) return;
    _vpnStatus = s;
    if (s == VpnStatus.connected) _reconnecting = false;
    if (s == VpnStatus.disconnected) {
      _activeServerId = null;
      _engine = _Engine.none;
      // Неожиданный обрыв при включённом kill-switch → авто-реконнект.
      if (_killSwitch && _userWantsConnected && _desiredServer != null && !_reconnecting) {
        _autoReconnect(_desiredServer!);
      }
    }
    notifyListeners();
  }

  Future<void> _autoReconnect(ServerInfo server) async {
    _reconnecting = true;
    notifyListeners();
    await Future<void>.delayed(const Duration(seconds: 2));
    if (!_userWantsConnected) {
      _reconnecting = false;
      return;
    }
    try {
      await connect(server);
    } catch (_) {
      _reconnecting = false;
    }
  }

  // Последняя VLESS-ссылка для импорта (когда встроенного туннеля ещё нет).
  String? vlessLinkForImport;

  // Готовый .conf WireGuard для показа (веб-версия — системного VPN в браузере
  // нет, туннель не поднять, поэтому конфиг отдаётся для проверки/импорта).
  String? wireguardConfigForImport;

  // Готовый .conf AmneziaWG для импорта в приложение AmneziaWG (встроенного
  // туннеля awg пока нет — плагин wireguard_flutter его не поддерживает).
  String? awgConfigForImport;

  /// Старт: восстанавливаем код из хранилища или регистрируем новый аккаунт.
  Future<void> init() async {
    phase = AppPhase.loading;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      _killSwitch = prefs.getBool(_killPref) ?? false;
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
  /// Возвращает true, если поднят туннель; false — если конфиг/ссылка отданы
  /// для импорта (нет встроенного движка на этой платформе).
  Future<bool> connect(ServerInfo server) async {
    if (account == null) return false;
    vlessLinkForImport = null;
    wireguardConfigForImport = null;
    awgConfigForImport = null;

    if (server.isVless) {
      final res = await _api.connect(account!.code, server.id);
      final link = res.link!;
      // Встроенный туннель Reality/WS через sing-box — если нативная часть есть.
      if (!kIsWeb && await _singbox.isAvailable()) {
        _engine = _Engine.singbox;
        _desiredServer = server;
        _userWantsConnected = true;
        _vpnStatus = VpnStatus.connecting;
        _activeServerId = server.id;
        notifyListeners();
        await _singbox.start(link);
        return true;
      }
      // Иначе — ссылка для импорта во внешний клиент (v2rayNG/Streisand).
      vlessLinkForImport = link;
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

    // AmneziaWG плагином не туннелируется — отдаём .conf для импорта в AmneziaWG.
    if (server.isAwg) {
      awgConfigForImport = conf;
      notifyListeners();
      return false;
    }

    // В браузере системного VPN нет — отдаём конфиг для проверки/импорта.
    if (kIsWeb) {
      wireguardConfigForImport = conf;
      notifyListeners();
      return false;
    }

    _engine = _Engine.wireguard;
    _desiredServer = server;
    _userWantsConnected = true;
    _vpnStatus = VpnStatus.connecting;
    _activeServerId = server.id;
    notifyListeners();
    await _vpn.connectWireguard(conf, server.id);
    // статус «connected» придёт из statusStream
    return true;
  }

  Future<void> disconnect() async {
    // Явное отключение пользователем — гасим намерение (иначе kill-switch
    // тут же переподключит).
    _userWantsConnected = false;
    _desiredServer = null;
    _reconnecting = false;
    if (_engine == _Engine.singbox) {
      await _singbox.stop();
    } else {
      await _vpn.disconnect();
    }
    _engine = _Engine.none;
    _activeServerId = null;
    _vpnStatus = VpnStatus.disconnected;
    notifyListeners();
  }

  /// Авто-подключение с пробой и фолбэком по протоколам:
  ///   1) WireGuard (UDP, быстрый) — перебор нод, ждём реального `connected`;
  ///   2) если UDP-путь не прошёл (вероятно, UDP зарезан) и доступен sing-box —
  ///      перебор VLESS-нод (TCP/443, обход блокировок).
  /// Возвращает сервер, к которому подключились, или null.
  Future<ServerInfo?> connectAuto({
    Duration probeTimeout = const Duration(seconds: 12),
  }) async {
    if (account == null) return null;

    // Этап 1 — WireGuard (сперва онлайн, затем остальные).
    final wg = servers.where((s) => s.canTunnel).toList();
    final wgOrdered = [...wg.where((s) => s.online), ...wg.where((s) => !s.online)];
    final byWg = await _probeConnect(wgOrdered, probeTimeout);
    if (byWg != null) return byWg;

    // Этап 2 — VLESS через sing-box (UDP, похоже, недоступен).
    if (!kIsWeb && await _singbox.isAvailable()) {
      final vless = servers.where((s) => s.isVless).toList();
      final vlessOrdered = [
        ...vless.where((s) => s.online),
        ...vless.where((s) => !s.online),
      ];
      final byVless = await _probeConnect(vlessOrdered, probeTimeout);
      if (byVless != null) return byVless;
    }
    return null;
  }

  // Перебирает серверы: поднимает туннель, ждёт `connected`, иначе рвёт и дальше.
  Future<ServerInfo?> _probeConnect(List<ServerInfo> list, Duration timeout) async {
    for (final server in list) {
      try {
        final tunneled = await connect(server);
        if (!tunneled) continue; // web-режим или отдано ссылкой/конфигом
        final ok = await _waitForStatus(VpnStatus.connected, timeout);
        if (ok) {
          _selectedServerId = server.id;
          return server;
        }
        await disconnect();
      } catch (e) {
        if (e is ApiException && e.isQuotaExceeded) rethrow; // квоту не обходим
        await disconnect().catchError((_) {});
      }
    }
    return null;
  }

  /// Ждёт, пока статус VPN станет [target], либо истечёт [timeout].
  /// Опрашивает _vpnStatus, который поддерживается подписками в конструкторе
  /// (не создаём второй listener на поток движка).
  Future<bool> _waitForStatus(VpnStatus target, Duration timeout) async {
    final deadline = DateTime.now().add(timeout);
    while (DateTime.now().isBefore(deadline)) {
      if (_vpnStatus == target) return true;
      if (_vpnStatus == VpnStatus.error) return false;
      await Future<void>.delayed(const Duration(milliseconds: 250));
    }
    return _vpnStatus == target;
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
    _sbSub?.cancel();
    super.dispose();
  }
}
