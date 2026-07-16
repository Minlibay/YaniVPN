/// Состояние аккаунта: квота трафика и план. Приходит от /api/app/*.
class Account {
  Account({
    required this.code,
    required this.dataUsed,
    required this.dataLimit,
    required this.plan,
    required this.exhausted,
  });

  /// Конфигурационный код — портативная личность пользователя.
  final String code;
  final int dataUsed;
  final int dataLimit;
  final String plan; // free | paid
  final bool exhausted;

  bool get isPaid => plan == 'paid';

  double get usedFraction =>
      dataLimit <= 0 ? 0 : (dataUsed / dataLimit).clamp(0, 1).toDouble();

  factory Account.fromJson(String code, Map<String, dynamic> json) {
    return Account(
      code: (json['code'] as String?) ?? code,
      dataUsed: (json['dataUsed'] as num?)?.toInt() ?? 0,
      dataLimit: (json['dataLimit'] as num?)?.toInt() ?? 0,
      plan: (json['plan'] as String?) ?? 'free',
      exhausted: (json['exhausted'] as bool?) ?? false,
    );
  }
}
