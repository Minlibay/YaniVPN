import 'package:flutter/material.dart';

import '../models/server_info.dart';
import '../theme.dart';

/// Карточка локации: флаг, название, протокол, онлайн-статус.
/// Тап выбирает сервер; выбранная карточка подсвечивается рамкой бренда.
class ServerTile extends StatelessWidget {
  const ServerTile({
    super.key,
    required this.server,
    required this.isSelected,
    required this.isActive,
    required this.isConnecting,
    required this.onTap,
  });

  final ServerInfo server;
  final bool isSelected;
  final bool isActive;
  final bool isConnecting;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      decoration: BoxDecoration(
        color: isSelected
            ? kBrandBlue.withValues(alpha: 0.08)
            : kSurfaceRaised.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isSelected ? kBrandBlue.withValues(alpha: 0.65) : kBorder,
          width: isSelected ? 1.4 : 1,
        ),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(18),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            child: Row(
              children: [
                Container(
                  width: 46,
                  height: 46,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: kBg,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: kBorder),
                  ),
                  child: Text(server.flag, style: const TextStyle(fontSize: 24)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Flexible(
                            child: Text(
                              server.name,
                              overflow: TextOverflow.ellipsis,
                              style: const TextStyle(
                                  fontWeight: FontWeight.w600, fontSize: 15),
                            ),
                          ),
                          const SizedBox(width: 8),
                          _OnlineDot(online: server.online),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Row(
                        children: [
                          _ProtocolChip(vless: server.isVless),
                          if (server.city.isNotEmpty) ...[
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                server.city,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(color: kTextDim, fontSize: 12),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _TrailingState(
                  isSelected: isSelected,
                  isActive: isActive,
                  isConnecting: isConnecting,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _OnlineDot extends StatelessWidget {
  const _OnlineDot({required this.online});
  final bool online;

  @override
  Widget build(BuildContext context) {
    final color = online ? kSuccess : kTextDim;
    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: color,
        boxShadow: online
            ? [BoxShadow(color: color.withValues(alpha: 0.6), blurRadius: 6)]
            : null,
      ),
    );
  }
}

class _ProtocolChip extends StatelessWidget {
  const _ProtocolChip({required this.vless});
  final bool vless;

  @override
  Widget build(BuildContext context) {
    final color = vless ? kSuccess : const Color(0xFF7DB4F0);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: color.withValues(alpha: 0.25)),
      ),
      child: Text(
        vless ? 'VLESS' : 'WireGuard',
        style: TextStyle(color: color, fontSize: 10.5, fontWeight: FontWeight.w700),
      ),
    );
  }
}

/// Правый край карточки: спиннер при подключении, галочка на активном
/// туннеле, радио-отметка выбора в остальных случаях.
class _TrailingState extends StatelessWidget {
  const _TrailingState({
    required this.isSelected,
    required this.isActive,
    required this.isConnecting,
  });

  final bool isSelected;
  final bool isActive;
  final bool isConnecting;

  @override
  Widget build(BuildContext context) {
    if (isConnecting) {
      return const SizedBox(
        width: 22,
        height: 22,
        child: CircularProgressIndicator(strokeWidth: 2, color: kBrandBlue),
      );
    }
    if (isActive) {
      return Container(
        width: 26,
        height: 26,
        decoration: const BoxDecoration(
          shape: BoxShape.circle,
          gradient: kBrandGradient,
        ),
        child: const Icon(Icons.check, size: 16, color: Colors.white),
      );
    }
    return Icon(
      isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
      size: 22,
      color: isSelected ? kBrandBlue : kBorder,
    );
  }
}
