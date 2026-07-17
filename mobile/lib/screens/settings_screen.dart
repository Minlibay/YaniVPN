import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

import '../state/app_state.dart';
import '../theme.dart';

/// Настройки: показ личного конфиг-кода (+ QR), kill-switch и вход по коду.
class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final code = state.account?.code ?? '';
    final isPaid = state.account?.plan == 'paid';

    return AppBackground(
      child: Scaffold(
        backgroundColor: Colors.transparent,
        appBar: AppBar(title: const Text('Настройки')),
        body: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: kBrandBlue.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.key_rounded,
                              color: kBrandBlue, size: 20),
                        ),
                        const SizedBox(width: 10),
                        const Text('Ваш конфигурационный код',
                            style: TextStyle(fontWeight: FontWeight.w600)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Сохраните его. Введите этот код на другом устройстве, чтобы '
                      'продолжить пользоваться VPN с тем же трафиком.',
                      style: TextStyle(color: kTextDim, fontSize: 13),
                    ),
                    const SizedBox(height: 16),
                    Center(
                      child: Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(14),
                          boxShadow: [
                            BoxShadow(
                              color: kBrandBlue.withValues(alpha: 0.25),
                              blurRadius: 30,
                            ),
                          ],
                        ),
                        child: QrImageView(data: code, size: 180),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: kBg,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: kBorder),
                      ),
                      child: SelectableText(
                        code,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                          fontFamily: 'monospace',
                          fontSize: 15,
                          letterSpacing: 1,
                        ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton.icon(
                        icon: const Icon(Icons.copy, size: 18),
                        label: const Text('Скопировать код'),
                        onPressed: () {
                          Clipboard.setData(ClipboardData(text: code));
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Код скопирован')),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: kBrandBlue.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.shield_rounded,
                              color: kBrandBlue, size: 20),
                        ),
                        const SizedBox(width: 10),
                        const Text('Kill-switch',
                            style: TextStyle(fontWeight: FontWeight.w600)),
                        const Spacer(),
                        Switch(
                          value: state.killSwitch,
                          onChanged: (v) => context.read<AppState>().setKillSwitch(v),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'При обрыве туннеля не пускать трафик напрямую — держать '
                      'переподключение. Для полной блокировки включите в системе '
                      '«Always-on VPN» + «Block connections without VPN».',
                      style: TextStyle(color: kTextDim, fontSize: 13),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(8),
                          decoration: BoxDecoration(
                            color: kSuccess.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(Icons.devices_rounded,
                              color: kSuccess, size: 20),
                        ),
                        const SizedBox(width: 10),
                        const Text('Войти по коду',
                            style: TextStyle(fontWeight: FontWeight.w600)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      'Перенос аккаунта с другого устройства. Текущий код будет заменён.',
                      style: TextStyle(color: kTextDim, fontSize: 13),
                    ),
                    const SizedBox(height: 12),
                    FilledButton.tonal(
                      onPressed: () => _showRestoreDialog(context),
                      child: const Text('Ввести код'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),
            Center(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
                decoration: BoxDecoration(
                  color: (isPaid ? kBrandBlue : kTextDim).withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  isPaid ? 'Премиум-аккаунт' : 'Бесплатный аккаунт',
                  style: TextStyle(
                    color: isPaid ? kBrandCyan : kTextDim,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showRestoreDialog(BuildContext context) async {
    final controller = TextEditingController();
    final state = context.read<AppState>();
    await showDialog<void>(
      context: context,
      builder: (dialogContext) {
        String? error;
        var busy = false;
        return StatefulBuilder(
          builder: (dialogContext, setSt) => AlertDialog(
            title: const Text('Вход по коду'),
            content: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: controller,
                  autofocus: true,
                  textCapitalization: TextCapitalization.characters,
                  decoration: const InputDecoration(
                    hintText: 'YANI-XXXX-XXXX-XXXX-XXXX',
                  ),
                ),
                if (error != null) ...[
                  const SizedBox(height: 10),
                  Text(error!, style: const TextStyle(color: kDanger, fontSize: 13)),
                ],
              ],
            ),
            actions: [
              TextButton(
                onPressed: busy ? null : () => Navigator.of(dialogContext).pop(),
                child: const Text('Отмена'),
              ),
              FilledButton(
                onPressed: busy
                    ? null
                    : () async {
                        setSt(() {
                          busy = true;
                          error = null;
                        });
                        try {
                          await state.restoreWithCode(controller.text);
                          if (dialogContext.mounted) Navigator.of(dialogContext).pop();
                        } catch (e) {
                          setSt(() {
                            busy = false;
                            error = 'Код не найден';
                          });
                        }
                      },
                child: busy
                    ? const SizedBox(
                        width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2))
                    : const Text('Войти'),
              ),
            ],
          ),
        );
      },
    );
  }
}
