import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../api/api_client.dart';
import '../state/app_state.dart';
import '../theme.dart';
import '../widgets/usage_bar.dart';

/// Экран покупки доступа. Оплата на бэкенде — заглушка (см. /api/app/upgrade);
/// в проде здесь встраивается in-app purchase магазина и валидация чека.
class PaywallScreen extends StatefulWidget {
  const PaywallScreen({super.key});

  @override
  State<PaywallScreen> createState() => _PaywallScreenState();
}

class _PaywallScreenState extends State<PaywallScreen> {
  bool _busy = false;
  String? _error;

  Future<void> _buy() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    final messenger = ScaffoldMessenger.of(context);
    try {
      await context.read<AppState>().upgrade();
      if (mounted) {
        messenger.showSnackBar(const SnackBar(content: Text('Доступ активирован')));
        Navigator.of(context).pop();
      }
    } on ApiException catch (e) {
      setState(() {
        _busy = false;
        _error = e.statusCode == 501
            ? 'Оплата ещё не подключена на сервере.'
            : e.message;
      });
    } catch (e) {
      setState(() {
        _busy = false;
        _error = '$e';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final account = context.watch<AppState>().account;

    return Scaffold(
      appBar: AppBar(title: const Text('Доступ к VPN')),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 8),
            const Icon(Icons.workspace_premium, size: 56, color: kBrandBlue),
            const SizedBox(height: 16),
            Text(
              'Безлимитный доступ',
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            const Text(
              'Бесплатно доступно 2 ГБ трафика. Оформите доступ, чтобы пользоваться '
              'VPN без ограничений на всех своих устройствах с одним кодом.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white70),
            ),
            const SizedBox(height: 24),
            if (account != null && !account.isPaid) UsageBar(account: account, onBuy: () {}),
            const Spacer(),
            if (_error != null) ...[
              Text(_error!,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Colors.redAccent, fontSize: 13)),
              const SizedBox(height: 12),
            ],
            const _PriceCard(),
            const SizedBox(height: 12),
            FilledButton(
              onPressed: _busy ? null : _buy,
              child: _busy
                  ? const SizedBox(
                      width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2))
                  : const Text('Купить доступ'),
            ),
            const SizedBox(height: 8),
            const Text(
              'Оплата через App Store / Google Play',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.white38, fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}

class _PriceCard extends StatelessWidget {
  const _PriceCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: kBrandBlue.withValues(alpha: 0.15),
                borderRadius: BorderRadius.circular(10),
              ),
              child: const Icon(Icons.all_inclusive, color: kBrandBlue),
            ),
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Премиум', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
                  Text('Безлимитный трафик, все серверы',
                      style: TextStyle(color: Colors.white60, fontSize: 13)),
                ],
              ),
            ),
            const Text('299 ₽/мес',
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          ],
        ),
      ),
    );
  }
}
