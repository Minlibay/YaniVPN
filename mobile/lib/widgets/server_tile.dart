import 'package:flutter/material.dart';

import '../models/server_info.dart';

/// Строка сервера в списке: флаг, название, протокол, статус и кнопка.
class ServerTile extends StatelessWidget {
  const ServerTile({
    super.key,
    required this.server,
    required this.isActive,
    required this.isConnecting,
    required this.onConnect,
    required this.onDisconnect,
  });

  final ServerInfo server;
  final bool isActive;
  final bool isConnecting;
  final VoidCallback onConnect;
  final VoidCallback onDisconnect;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Row(
          children: [
            Text(server.flag, style: const TextStyle(fontSize: 26)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(server.name,
                      style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 15)),
                  const SizedBox(height: 2),
                  Row(
                    children: [
                      _ProtocolChip(protocol: server.protocol),
                      if (server.city.isNotEmpty) ...[
                        const SizedBox(width: 8),
                        Text(server.city,
                            style: const TextStyle(color: Colors.white54, fontSize: 12)),
                      ],
                    ],
                  ),
                ],
              ),
            ),
            _ConnectButton(
              isActive: isActive,
              isConnecting: isConnecting,
              onConnect: onConnect,
              onDisconnect: onDisconnect,
            ),
          ],
        ),
      ),
    );
  }
}

class _ProtocolChip extends StatelessWidget {
  const _ProtocolChip({required this.protocol});
  final String protocol; // wireguard | awg | vless

  @override
  Widget build(BuildContext context) {
    final (color, label) = switch (protocol) {
      'vless' => (const Color(0xFF34D399), 'VLESS'),
      'awg' => (const Color(0xFFC084FC), 'AmneziaWG'),
      _ => (const Color(0xFF7DB4F0), 'WireGuard'),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(label,
          style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.w600)),
    );
  }
}

class _ConnectButton extends StatelessWidget {
  const _ConnectButton({
    required this.isActive,
    required this.isConnecting,
    required this.onConnect,
    required this.onDisconnect,
  });

  final bool isActive;
  final bool isConnecting;
  final VoidCallback onConnect;
  final VoidCallback onDisconnect;

  @override
  Widget build(BuildContext context) {
    if (isConnecting) {
      return const SizedBox(
        width: 92,
        height: 36,
        child: Center(
          child: SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2)),
        ),
      );
    }
    if (isActive) {
      return SizedBox(
        width: 92,
        child: OutlinedButton(
          onPressed: onDisconnect,
          style: OutlinedButton.styleFrom(
            foregroundColor: Colors.redAccent,
            side: const BorderSide(color: Colors.redAccent),
          ),
          child: const Text('Отключить', style: TextStyle(fontSize: 12)),
        ),
      );
    }
    return SizedBox(
      width: 92,
      child: FilledButton(
        onPressed: onConnect,
        style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 8)),
        child: const Text('Подключить', style: TextStyle(fontSize: 12)),
      ),
    );
  }
}
