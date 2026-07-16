import 'dart:convert';
import 'package:http/http.dart' as http;

import '../config.dart';
import '../models/account.dart';
import '../models/server_info.dart';

/// Ошибка API с HTTP-статусом (для отделения 402 «квота» и 401 «нет доступа»).
class ApiException implements Exception {
  ApiException(this.statusCode, this.message, [this.code]);
  final int statusCode;
  final String message;
  final String? code; // машинный код, напр. quota_exceeded

  bool get isQuotaExceeded => statusCode == 402 || code == 'quota_exceeded';

  @override
  String toString() => message;
}

/// Результат /api/app/connect.
class ConnectResult {
  ConnectResult.wireguard({required this.address, required this.configTemplate})
      : protocol = 'wireguard',
        link = null;
  ConnectResult.vless({required this.link})
      : protocol = 'vless',
        address = null,
        configTemplate = null;

  final String protocol;
  final String? address; // WG: адрес в туннеле
  final String? configTemplate; // WG: .conf с плейсхолдером %PRIVATE_KEY%
  final String? link; // VLESS: vless://…
}

/// Тонкий клиент бэкенда YaniVPN. Аутентификация — Bearer <код аккаунта>.
class ApiClient {
  ApiClient({http.Client? client, String baseUrl = kApiBase})
      : _client = client ?? http.Client(),
        _base = baseUrl;

  final http.Client _client;
  final String _base;

  Uri _u(String path) => Uri.parse('$_base$path');

  Map<String, String> _headers(String? code) => {
        'Content-Type': 'application/json',
        if (code != null) 'Authorization': 'Bearer $code',
      };

  Never _throw(http.Response r) {
    Map<String, dynamic>? body;
    try {
      body = jsonDecode(r.body) as Map<String, dynamic>;
    } catch (_) {}
    throw ApiException(
      r.statusCode,
      (body?['error'] as String?) ?? 'Ошибка сервера (${r.statusCode})',
      body?['code'] as String?,
    );
  }

  /// Регистрация анонимного аккаунта → выдаётся конфиг-код.
  Future<Account> register() async {
    final r = await _client.post(_u('/api/app/register'), headers: _headers(null));
    if (r.statusCode != 201) _throw(r);
    final json = jsonDecode(r.body) as Map<String, dynamic>;
    return Account.fromJson(json['code'] as String, json);
  }

  /// Вход по коду с другого устройства.
  Future<Account> session(String code) async {
    final r = await _client.post(
      _u('/api/app/session'),
      headers: _headers(null),
      body: jsonEncode({'code': code}),
    );
    if (r.statusCode != 200) _throw(r);
    final json = jsonDecode(r.body) as Map<String, dynamic>;
    return Account.fromJson(code, json);
  }

  Future<Account> usage(String code) async {
    final r = await _client.get(_u('/api/app/usage'), headers: _headers(code));
    if (r.statusCode != 200) _throw(r);
    return Account.fromJson(code, jsonDecode(r.body) as Map<String, dynamic>);
  }

  Future<List<ServerInfo>> servers(String code) async {
    final r = await _client.get(_u('/api/app/servers'), headers: _headers(code));
    if (r.statusCode != 200) _throw(r);
    final json = jsonDecode(r.body) as Map<String, dynamic>;
    return (json['servers'] as List)
        .map((e) => ServerInfo.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Запрашивает конфигурацию подключения. Для WireGuard передаётся публичный
  /// ключ устройства (приватный не покидает телефон).
  Future<ConnectResult> connect(
    String code,
    String serverId, {
    String? clientPublicKey,
  }) async {
    final r = await _client.post(
      _u('/api/app/connect'),
      headers: _headers(code),
      body: jsonEncode({
        'serverId': serverId,
        if (clientPublicKey != null) 'clientPublicKey': clientPublicKey,
      }),
    );
    if (r.statusCode != 200) _throw(r);
    final json = jsonDecode(r.body) as Map<String, dynamic>;
    if (json['protocol'] == 'vless') {
      return ConnectResult.vless(link: json['link'] as String);
    }
    return ConnectResult.wireguard(
      address: json['address'] as String,
      configTemplate: json['configTemplate'] as String,
    );
  }

  /// Оплата (заглушка на бэкенде — требует ALLOW_MOCK_PURCHASE в dev).
  Future<Account> upgrade(String code, String receipt, String platform) async {
    final r = await _client.post(
      _u('/api/app/upgrade'),
      headers: _headers(code),
      body: jsonEncode({'receipt': receipt, 'platform': platform}),
    );
    if (r.statusCode != 200) _throw(r);
    return Account.fromJson(code, jsonDecode(r.body) as Map<String, dynamic>);
  }
}
