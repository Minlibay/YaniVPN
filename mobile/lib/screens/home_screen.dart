import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../models/server_info.dart';
import '../state/app_state.dart';
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
        return Scaffold(
          appBar: AppBar(
            title: const Text('Yani', style: TextStyle(fontWeight: FontWeight.bold)),
            actions: [
              IconButton(
                icon: const Icon(Icons.settings_outlined),
                onPressed: state.account == null
                    ? null
                    : () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const SettingsScreen()),
                        ),
              ),
            ],
          ),
          body: switch (state.phase) {
            AppPhase.loading => const Center(child: CircularProgressIndicator()),
            AppPhase.error => _ErrorView(message: state.errorMessage ?? 'Ошибка'),
            AppPhase.ready => _Content(state: state),
          },
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
      if (!tunneled && state.vlessLinkForImport != null && context.mounted) {
        await _showVlessImport(context, state.vlessLinkForImport!);
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

  Future<void> _showVlessImport(BuildContext context, String link) {
    return showModalBottomSheet(
      context: context,
      builder: (_) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text('VLESS-подключение',
                style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
            const SizedBox(height: 8),
            const Text(
              'Скопируйте ссылку и импортируйте её в приложение с поддержкой '
              'VLESS+Reality (v2rayNG, Streisand, Shadowrocket). Встроенный '
              'туннель VLESS появится в следующих версиях.',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 16),
            SelectableText(link, style: const TextStyle(fontSize: 12)),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                icon: const Icon(Icons.copy, size: 18),
                label: const Text('Скопировать ссылку'),
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: link));
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
    return RefreshIndicator(
      onRefresh: () async {
        await state.refreshServers();
        await state.refreshUsage();
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          UsageBar(
            account: account,
            onBuy: () => Navigator.of(context).push(
              MaterialPageRoute(builder: (_) => const PaywallScreen()),
            ),
          ),
          const SizedBox(height: 20),
          Text('Серверы', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          if (state.servers.isEmpty)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: Center(child: Text('Серверов пока нет', style: TextStyle(color: Colors.white54))),
            ),
          for (final server in state.servers)
            Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: ServerTile(
                server: server,
                isActive: state.activeServerId == server.id && state.isConnected,
                isConnecting: state.activeServerId == server.id && state.isBusy,
                onConnect: () => _connect(context, server),
                onDisconnect: state.disconnect,
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
            const Icon(Icons.cloud_off, size: 48, color: Colors.white38),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white70)),
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
