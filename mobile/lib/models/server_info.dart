/// Сервер из списка /api/app/servers.
class ServerInfo {
  ServerInfo({
    required this.id,
    required this.name,
    required this.country,
    required this.city,
    required this.protocol,
    required this.online,
  });

  final String id;
  final String name;
  final String country; // ISO-код, напр. NL
  final String city;
  final String protocol; // wireguard | awg | vless
  final bool online;

  bool get isVless => protocol == 'vless';
  bool get isAwg => protocol == 'awg';

  // Что приложение умеет туннелировать штатным плагином прямо сейчас.
  // AmneziaWG и VLESS требуют своих движков — пока отдаются конфигом/ссылкой.
  bool get canTunnel => protocol == 'wireguard';

  /// Флаг-эмодзи из ISO-кода страны (NL → 🇳🇱).
  String get flag {
    if (country.length != 2) return '🌐';
    final upper = country.toUpperCase();
    return String.fromCharCodes([
      0x1F1E6 + upper.codeUnitAt(0) - 65,
      0x1F1E6 + upper.codeUnitAt(1) - 65,
    ]);
  }

  factory ServerInfo.fromJson(Map<String, dynamic> json) {
    return ServerInfo(
      id: json['id'] as String,
      name: json['name'] as String,
      country: (json['country'] as String?) ?? '',
      city: (json['city'] as String?) ?? '',
      protocol: (json['protocol'] as String?) ?? 'wireguard',
      online: (json['online'] as bool?) ?? false,
    );
  }
}
