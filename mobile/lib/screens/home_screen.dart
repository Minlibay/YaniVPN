import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models/server_info.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/brand.dart';
import '../widgets/connect_button.dart';
import '../widgets/server_tile.dart';
import '../widgets/usage_bar.dart';
import 'settings_screen.dart';
import 'paywall_screen.dart';

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Consumer<AppState>(
      builder: (context, state, _) {
        return AppBackground(
          child: Scaffold(
            backgroundColor: Colors.transparent,
            appBar: AppBar(
              title: const BrandWordmark(),
              actions: [
                IconButton(
                  icon: const Icon(Icons.settings_outlined, color: kTextDim),
                  onPressed: state.account == null
                      ? null
                      : () => Navigator.of(context).push(
                            MaterialPageRoute(builder: (_) => const SettingsScreen()),
                          ),
                ),
              ],
            ),
            body: switch (state.phase) {
              AppPhase.loading =>
                const Center(child: CircularProgressIndicator(color: kBrandBlue)),
              AppPhase.error => _ErrorView(message: state.errorMessage ?? 'Ошибка'),
              AppPhase.ready => _Content(state: state),
            },
          ),
        );
      },
    );
  }
}

class _Content extends StatelessWidget {
  const _Content({required this.state});
  final AppState state;

  Future<void> _connect(BuildContext context, ServerInfo server) async {
    final messenger = ScaffoldMessenger.of(context);
    try {
      final tunneled = await state.connect(server);
      if (!tunneled && context.mounted) {
        if (state.vlessLinkForImport != null) {
          await _showConfigSheet(
            context,
            title: 'VLESS-подключение',
            note: 'Скопируйте ссылку и импортируйте её в приложение с поддержкой '
                'VLESS+Reality (v2rayNG, Streisand, Shadowrocket). Встроенный '
                'туннель VLESS появится в следующих версиях.',
            body: state.vlessLinkForImport!,
          );
        } else if (state.wireguardConfigForImport != null) {
          await _showConfigSheet(
            context,
            title: 'Конфигурация WireGuard',
            note: 'В браузере системный VPN недоступен — туннель поднимается '
                'в сборке под Android/iOS. Здесь конфиг можно проверить или '
                'импортировать в приложение WireGuard.',
            body: state.wireguardConfigForImport!,
          );
        }
      }
    } on ApiException catch (e) {
      if (e.isQuotaExceeded && context.mounted) {
        await state.refreshUsage();
        if (context.mounted) {
          Navigator.of(context).push(
            MaterialPageRoute(builder: (_) => const PaywallScreen()),
          );
        }
      } else {
        messenger.showSnackBar(SnackBar(content: Text(e.message)));
      }
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text('$e')));
    }
  }

  Future<void> _onServerTap(BuildContext context, ServerInfo server) async {
    final wasActive = state.activeServerId == server.id && state.isConnected;
    state.selectServer(server);
    // Переключение на другой сервер при активном туннеле — переподключаемся.
    if (state.isConnected && !wasActive) {
      await state.disconnect();
      if (context.mounted) await _connect(context, server);
    }
  }

  Future<void> _showConfigSheet(
    BuildContext context, {
    required String title,
    required String note,
    required String body,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            Text(note, style: const TextStyle(color: kTextDim, fontSize: 13)),
            const SizedBox(height: 16),
            Container(
              width: double.infinity,
              constraints: const BoxConstraints(maxHeight: 200),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: kBg,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: kBorder),
              ),
              child: SingleChildScrollView(
                child: SelectableText(
                  body,
                  style: const TextStyle(fontFamily: 'monospace', fontSize: 12),
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                icon: const Icon(Icons.copy, size: 18),
                label: const Text('Скопировать'),
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: body));
                  Navigator.of(context).pop();
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final account = state.account!;
    final selected = state.selectedServer;
    final connecting = state.isBusy;
    final connected = state.isConnected;

    final statusText = connecting
        ? 'Устанавливаем защищённое соединение…'
        : connected
            ? 'Ваш трафик зашифрован'
            : 'Нажмите, чтобы подключиться';

    return RefreshIndicator(
      color: kBrandBlue,
      onRefresh: () async {
        await state.refreshServers();
        await state.refreshUsage();
      },
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
        children: [
          const SizedBox(height: 16),
          Center(
            child: _MascotConnect(
              child: ConnectButton(
                connected: connected,
                connecting: connecting,
                enabled: selected != null && !connecting,
                onTap: () {
                  if (connected) {
                    state.disconnect();
                  } else if (selected != null) {
                    _connect(context, selected);
                  }
                },
              ),
            ),
          ),
          const SizedBox(height: 12),
          AnimatedSwitcher(
            duration: const Duration(milliseconds: 250),
            child: Text(
              statusText,
              key: ValueKey(statusText),
              textAlign: TextAlign.center,
              style: TextStyle(
                color: connected ? kBrandCyan : kTextDim,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
          const SizedBox(height: 24),
          UsageBar(
            account: account,
            onBuy: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const PaywallScreen()),
            ),
          ),
          const SizedBox(height: 28),
          Row(
            children: [
              Text(
                'ЛОКАЦИИ',
                style: TextStyle(
                  color: kTextDim.withValues(alpha: 0.8),
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 2,
                ),
              ),
              const Spacer(),
              Text(
                '${state.servers.length}',
                style: const TextStyle(color: kTextDim, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (state.servers.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(
                child: Text('Серверов пока нет', style: TextStyle(color: kTextDim)),
              ),
            ),
          for (final server in state.servers)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: ServerTile(
                server: server,
                isSelected: selected?.id == server.id,
                isActive: state.activeServerId == server.id && connected,
                isConnecting: state.activeServerId == server.id && connecting,
                onTap: () => _onServerTap(context, server),
              ),
            ),
        ],
      ),
    );
  }
}

/// Маскот YaniVPN сидит на кнопке подключения: лапы свисают за верхний
/// край кольца, а сама кнопка (включая градиент и свечение) остаётся живой.
/// Геометрия повторяет исходный арт: кот масштабирован к диаметру кольца.
class _MascotConnect extends StatelessWidget {
  const _MascotConnect({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 246,
      height: 348,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Positioned(bottom: 0, left: 0, child: child),
          Positioned(
            top: 0,
            left: 15,
            child: IgnorePointer(
              child: Image.asset(
                'assets/images/mascot_cat.png',
                width: 245,
                filterQuality: FilterQuality.medium,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorView extends StatelessWidget {
  const _ErrorView({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.cloud_off, size: 48, color: kTextDim),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: kTextDim)),
            const SizedBox(height: 20),
            FilledButton(
              onPressed: () => context.read<AppState>().init(),
              child: const Text('Повторить'),
            ),
          ],
        ),
      ),
    );
  }
}
