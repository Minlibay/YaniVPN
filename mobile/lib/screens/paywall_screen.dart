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

    return AppBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(title: const Text('Доступ к VPN')),
        body: Padding(
          padding: const EdgeInsets.all(20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 8),
              Center(
                child: Container(
                  padding: const EdgeInsets.all(18),
                  decoration: BoxDecoration(
                    gradient: kBrandGradient,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: kBrandBlue.withValues(alpha: 0.4),
                        blurRadius: 40,
                      ),
                    ],
                  ),
                  child: const Icon(Icons.workspace_premium,
                      size: 44, color: Colors.white),
                ),
              ),
              const SizedBox(height: 20),
              Text(
                'Безлимитный доступ',
                textAlign: TextAlign.center,
                style: Theme.of(context)
                    .textTheme
                    .headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 8),
              const Text(
                'Бесплатно доступно 2 ГБ трафика. Оформите доступ, чтобы пользоваться '
                'VPN без ограничений на всех своих устройствах с одним кодом.',
                textAlign: TextAlign.center,
                style: TextStyle(color: kTextDim),
              ),
              const SizedBox(height: 24),
              if (account != null && !account.isPaid)
                UsageBar(account: account, onBuy: () {}),
              const Spacer(),
              if (_error != null) ...[
                Text(_error!,
                    textAlign: TextAlign.center,
                    style: const TextStyle(color: kDanger, fontSize: 13)),
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
                style: TextStyle(color: kTextDim, fontSize: 12),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PriceCard extends StatelessWidget {
  const _PriceCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: kBrandBlue.withValues(alpha: 0.07),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: kBrandBlue.withValues(alpha: 0.45)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              gradient: kBrandGradient,
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.all_inclusive, color: Colors.white, size: 22),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Премиум',
                    style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16)),
                SizedBox(height: 2),
                Text('Безлимитный трафик, все серверы',
                    style: TextStyle(color: kTextDim, fontSize: 13)),
              ],
            ),
          ),
          const Text('299 ₽/мес',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
        ],
      ),
    );
  }
}
