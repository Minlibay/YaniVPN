import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

import 'vpn_service.dart' show VpnStatus;

/// Встроенный туннель обходных протоколов (VLESS+Reality / VLESS+WS) через
/// sing-box. Даёт то, чего не умеет wireguard_flutter: поднять Reality-туннель
/// прямо в приложении, а не отдавать ссылку во внешний клиент.
///
/// Нативная часть (Android VpnService + libbox / iOS NetworkExtension) общается
/// через MethodChannel. Пока она не подключена, [isAvailable] вернёт false и
/// приложение корректно откатится к показу ссылки для импорта — ничего не
/// ломается. Контракт каналов и генерация конфига здесь готовы полностью.
///
/// Контракт нативной стороны:
///   method  'isAvailable'  -> bool
///   method  'start' {config: <json>}  -> void
///   method  'stop'  -> void
///   event channel .../status  -> String: connected|connecting|disconnected|error
class SingboxService {
  static const _method = MethodChannel('com.yanivpn/singbox');
  static const _status = EventChannel('com.yanivpn/singbox/status');

  bool? _available;

  /// Есть ли рабочая нативная реализация sing-box на этой платформе/сборке.
  Future<bool> isAvailable() async {
    if (kIsWeb) return false;
    if (_available != null) return _available!;
    try {
      _available = (await _method.invokeMethod<bool>('isAvailable')) ?? false;
    } on MissingPluginException {
      _available = false;
    } catch (_) {
      _available = false;
    }
    return _available!;
  }

  /// Поднимает туннель по ссылке vless://…
  Future<void> start(String vlessLink) async {
    final config = buildSingboxConfig(vlessLink);
    await _method.invokeMethod('start', {'config': jsonEncode(config)});
  }

  Future<void> stop() async {
    try {
      await _method.invokeMethod('stop');
    } on MissingPluginException {
      // нативной части нет — нечего останавливать
    }
  }

  /// Поток статуса от нативного туннеля. Ошибки (нет реализации) гасятся в
  /// пустой поток, чтобы подписка в AppState не падала.
  Stream<VpnStatus> statusStream() {
    if (kIsWeb) return const Stream<VpnStatus>.empty();
    return _status
        .receiveBroadcastStream()
        .map((e) => _mapStatus(e as String))
        .handleError((_) {});
  }

  VpnStatus _mapStatus(String s) {
    switch (s) {
      case 'connected':
        return VpnStatus.connected;
      case 'connecting':
        return VpnStatus.connecting;
      case 'error':
        return VpnStatus.error;
      default:
        return VpnStatus.disconnected;
    }
  }
}

/// Разобранная ссылка vless://uuid@host:port?params#name
class VlessLink {
  VlessLink({
    required this.uuid,
    required this.host,
    required this.port,
    required this.params,
  });

  final String uuid;
  final String host;
  final int port;
  final Map<String, String> params;

  static VlessLink parse(String link) {
    final uri = Uri.parse(link.trim());
    if (uri.scheme != 'vless') {
      throw FormatException('Не vless-ссылка: ${uri.scheme}');
    }
    return VlessLink(
      uuid: uri.userInfo,
      host: uri.host,
      port: uri.port == 0 ? 443 : uri.port,
      params: uri.queryParameters,
    );
  }
}

/// Строит конфиг sing-box (schema 1.8+) из ссылки vless://.
/// Поддерживает Reality (security=reality) и WebSocket+TLS (type=ws).
/// tun-inbound с auto_route/strict_route + DNS через прокси — защита от утечек.
Map<String, dynamic> buildSingboxConfig(String vlessLink) {
  final v = VlessLink.parse(vlessLink);
  final security = v.params['security'] ?? 'tls';
  final sni = v.params['sni'] ?? v.params['host'] ?? v.host;
  final network = v.params['type'] ?? 'tcp';

  final tls = <String, dynamic>{
    'enabled': true,
    'server_name': sni,
    'utls': {'enabled': true, 'fingerprint': v.params['fp'] ?? 'chrome'},
  };
  if (security == 'reality') {
    tls['reality'] = {
      'enabled': true,
      'public_key': v.params['pbk'] ?? '',
      'short_id': v.params['sid'] ?? '',
    };
  }

  final outbound = <String, dynamic>{
    'type': 'vless',
    'tag': 'proxy',
    'server': v.host,
    'server_port': v.port,
    'uuid': v.uuid,
    'tls': tls,
  };
  final flow = v.params['flow'];
  if (flow != null && flow.isNotEmpty) outbound['flow'] = flow;

  if (network == 'ws') {
    outbound['transport'] = {
      'type': 'ws',
      'path': v.params['path'] ?? '/',
      'headers': {'Host': v.params['host'] ?? sni},
    };
  }

  return {
    'log': {'level': 'error'},
    // DNS резолвится через прокси-выход → провайдер не видит домены (no leak).
    'dns': {
      'servers': [
        {'tag': 'proxy-dns', 'address': 'https://1.1.1.1/dns-query', 'detour': 'proxy'},
      ],
      'strategy': 'ipv4_only',
    },
    'inbounds': [
      {
        'type': 'tun',
        'tag': 'tun-in',
        'inet4_address': '172.19.0.1/30',
        'auto_route': true,
        'strict_route': true,
        'stack': 'system',
        'sniff': true,
      },
    ],
    'outbounds': [
      outbound,
      {'type': 'direct', 'tag': 'direct'},
      {'type': 'dns', 'tag': 'dns-out'},
    ],
    'route': {
      'rules': [
        {'protocol': 'dns', 'outbound': 'dns-out'},
      ],
      'final': 'proxy',
      'auto_detect_interface': true,
    },
  };
}
