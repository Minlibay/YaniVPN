import 'package:flutter/material.dart';

import '../models/account.dart';
import '../theme.dart';

String formatBytes(int bytes) {
  double n = bytes.toDouble();
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  var i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  final digits = n >= 100 || i == 0 ? 0 : 1;
  return '${n.toStringAsFixed(digits)} ${units[i]}';
}

/// Карточка квоты: градиентная полоса «использовано / лимит»,
/// у платного плана — значок безлимита.
class UsageBar extends StatelessWidget {
  const UsageBar({super.key, required this.account, required this.onBuy});

  final Account account;
  final VoidCallback onBuy;

  @override
  Widget build(BuildContext context) {
    if (account.isPaid) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                padding: const EdgeInsets.all(9),
                decoration: BoxDecoration(
                  gradient: kBrandGradient,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: const Icon(Icons.all_inclusive, color: Colors.white, size: 20),
              ),
              const SizedBox(width: 12),
              Text('Безлимитный доступ',
                  style: Theme.of(context).textTheme.titleMedium),
            ],
          ),
        ),
      );
    }

    final fraction = account.usedFraction;
    final danger = account.exhausted;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Бесплатный трафик',
                    style: TextStyle(color: kTextDim, fontSize: 13)),
                Text(
                  '${formatBytes(account.dataUsed)} / ${formatBytes(account.dataLimit)}',
                  style: const TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    fontFeatures: [FontFeature.tabularFigures()],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            // Градиентная полоса прогресса; при исчерпании — красная.
            ClipRRect(
              borderRadius: BorderRadius.circular(6),
              child: SizedBox(
                height: 8,
                child: Stack(
                  children: [
                    Container(color: kBg),
                    FractionallySizedBox(
                      widthFactor: fraction == 0 ? 0.005 : fraction,
                      child: DecoratedBox(
                        decoration: BoxDecoration(
                          gradient: danger ? null : kBrandGradient,
                          color: danger ? kDanger : null,
                        ),
                        child: const SizedBox.expand(),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (danger) ...[
              const SizedBox(height: 12),
              const Text(
                'Лимит исчерпан. Купите доступ, чтобы продолжить.',
                style: TextStyle(color: kDanger, fontSize: 13),
              ),
              const SizedBox(height: 10),
              SizedBox(
                width: double.infinity,
                child: FilledButton(onPressed: onBuy, child: const Text('Купить доступ')),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
