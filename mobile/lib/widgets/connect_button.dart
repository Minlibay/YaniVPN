import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

/// Кнопка подключения, встроенная в арт маскота.
///
/// Показывается исходная картинка целиком (кот на тёмном круге), а поверх
/// её круга рисуются живые элементы: иконка и подпись состояния, вращающаяся
/// градиентная дуга при подключении, градиентное кольцо и «дышащее» свечение
/// в подключённом состоянии, расходящиеся «радарные» волны. Нажатие даёт
/// тактильную «пружинку». Тап по картинке включает/выключает VPN.
class ConnectButton extends StatefulWidget {
  const ConnectButton({
    super.key,
    required this.connected,
    required this.connecting,
    required this.enabled,
    required this.onTap,
  });

  final bool connected;
  final bool connecting;
  final bool enabled;
  final VoidCallback onTap;

  @override
  State<ConnectButton> createState() => _ConnectButtonState();
}

// Геометрия исходного арта (mascote.png, 1024×1536):
// центр круга-подложки и его радиус. По ним позиционируются все наложения.
const double _artW = 1024;
const double _artH = 1536;
const double _artCx = 503;
const double _artCy = 1032;
const double _artR = 379;

class _ConnectButtonState extends State<ConnectButton>
    with TickerProviderStateMixin {
  // Быстрый цикл: вращение дуги и «дыхание» свечения.
  late final AnimationController _spin = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 2),
  );
  // Медленный цикл: расходящиеся волны от круга.
  late final AnimationController _pulse = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 2600),
  );
  bool _pressed = false;

  @override
  void initState() {
    super.initState();
    _syncAnimation();
  }

  @override
  void didUpdateWidget(ConnectButton oldWidget) {
    super.didUpdateWidget(oldWidget);
    _syncAnimation();
  }

  void _syncAnimation() {
    if (widget.connecting || widget.connected) {
      if (!_spin.isAnimating) _spin.repeat();
      if (!_pulse.isAnimating) _pulse.repeat();
    } else {
      _spin.stop();
      _spin.value = 0;
      _pulse.stop();
      _pulse.value = 0;
    }
  }

  @override
  void dispose() {
    _spin.dispose();
    _pulse.dispose();
    super.dispose();
  }

  void _setPressed(bool v) {
    if (widget.enabled && _pressed != v) setState(() => _pressed = v);
  }

  @override
  Widget build(BuildContext context) {
    const width = 300.0;
    const s = width / _artW;
    const cx = _artCx * s;
    const cy = _artCy * s;
    const r = _artR * s;

    return Semantics(
      button: true,
      label: widget.connected ? 'Отключить VPN' : 'Подключить VPN',
      child: GestureDetector(
        onTap: widget.enabled ? widget.onTap : null,
        onTapDown: (_) => _setPressed(true),
        onTapUp: (_) => _setPressed(false),
        onTapCancel: () => _setPressed(false),
        child: AnimatedScale(
          scale: _pressed ? 0.965 : 1,
          duration: const Duration(milliseconds: 120),
          curve: Curves.easeOut,
          child: AnimatedBuilder(
            animation: Listenable.merge([_spin, _pulse]),
            builder: (context, _) {
              final breath = widget.connected
                  ? 0.5 + 0.5 * math.sin(_spin.value * 2 * math.pi)
                  : 0.0;
              return SizedBox(
                width: width,
                height: _artH * s,
                child: Stack(
                  clipBehavior: Clip.none,
                  children: [
                    // Расходящиеся волны от круга (радар) — живут и при
                    // подключении, и в защищённом состоянии.
                    if (widget.connecting || widget.connected)
                      Positioned(
                        left: cx - r * 1.35,
                        top: cy - r * 1.35,
                        child: SizedBox(
                          width: r * 2.7,
                          height: r * 2.7,
                          child: CustomPaint(
                            painter: _PulseWavesPainter(
                              progress: _pulse.value,
                              baseRadius: r,
                              color:
                                  widget.connected ? kBrandCyan : kBrandBlue,
                            ),
                          ),
                        ),
                      ),
                    // Свечение позади картинки в подключённом состоянии
                    if (widget.connected)
                      Positioned(
                        left: cx - r,
                        top: cy - r,
                        child: Container(
                          width: r * 2,
                          height: r * 2,
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            boxShadow: [
                              BoxShadow(
                                color: kBrandBlue.withValues(
                                    alpha: 0.30 + breath * 0.14),
                                blurRadius: 60,
                                spreadRadius: 8,
                              ),
                              BoxShadow(
                                color: kBrandCyan.withValues(alpha: 0.15),
                                blurRadius: 90,
                                spreadRadius: 20,
                              ),
                            ],
                          ),
                        ),
                      ),
                    Positioned.fill(
                      child: Image.asset(
                        'assets/images/mascote.png',
                        fit: BoxFit.fill,
                        filterQuality: FilterQuality.medium,
                      ),
                    ),
                    // Вращающаяся дуга при подключении — чуть внутри ободка арта
                    if (widget.connecting)
                      Positioned(
                        left: cx - r + 6,
                        top: cy - r + 6,
                        child: SizedBox(
                          width: (r - 6) * 2,
                          height: (r - 6) * 2,
                          child: Transform.rotate(
                            angle: _spin.value * 2 * math.pi,
                            child: CustomPaint(painter: _ArcPainter()),
                          ),
                        ),
                      ),
                    // Вторая дуга в противофазе — «плетение» при подключении
                    if (widget.connecting)
                      Positioned(
                        left: cx - r + 14,
                        top: cy - r + 14,
                        child: SizedBox(
                          width: (r - 14) * 2,
                          height: (r - 14) * 2,
                          child: Transform.rotate(
                            angle: -_spin.value * 2 * math.pi * 0.7 + math.pi,
                            child: CustomPaint(
                              painter: _ArcPainter(opacity: 0.45),
                            ),
                          ),
                        ),
                      ),
                    // Градиентное кольцо по ободку в подключённом состоянии
                    if (widget.connected)
                      Positioned(
                        left: cx - r,
                        top: cy - r,
                        child: SizedBox(
                          width: r * 2,
                          height: r * 2,
                          child: CustomPaint(
                            painter: _RingPainter(opacity: 0.7 + breath * 0.3),
                          ),
                        ),
                      ),
                    // Иконка и подпись в центре круга
                    Positioned(
                      left: cx - 80,
                      top: cy - 52,
                      width: 160,
                      child: Column(
                        children: [
                          AnimatedSwitcher(
                            duration: const Duration(milliseconds: 300),
                            switchInCurve: Curves.easeOutBack,
                            switchOutCurve: Curves.easeIn,
                            transitionBuilder: (child, anim) => ScaleTransition(
                              scale: anim,
                              child: FadeTransition(opacity: anim, child: child),
                            ),
                            child: Icon(
                              widget.connected
                                  ? Icons.shield_rounded
                                  : Icons.power_settings_new_rounded,
                              key: ValueKey(widget.connected),
                              size: 52,
                              color: widget.connected
                                  ? kBrandCyan
                                  : (widget.enabled ? kBrandBlue : kTextDim),
                            ),
                          ),
                          const SizedBox(height: 8),
                          AnimatedSwitcher(
                            duration: const Duration(milliseconds: 250),
                            child: Text(
                              widget.connecting
                                  ? 'СОЕДИНЕНИЕ'
                                  : (widget.connected ? 'ЗАЩИЩЕНО' : 'ВКЛЮЧИТЬ'),
                              key: ValueKey(
                                  '${widget.connecting}-${widget.connected}'),
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w700,
                                letterSpacing: 2.5,
                                color: widget.connected
                                    ? Colors.white.withValues(alpha: 0.95)
                                    : kTextDim,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// Градиентная дуга (3/4 круга) для состояния «подключение».
class _ArcPainter extends CustomPainter {
  _ArcPainter({this.opacity = 1});
  final double opacity;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round
      ..shader = SweepGradient(
        colors: [
          Colors.transparent,
          kBrandBlue.withValues(alpha: opacity),
          kBrandCyan.withValues(alpha: opacity),
        ],
        stops: const [0.25, 0.6, 1],
      ).createShader(rect);
    canvas.drawArc(rect.deflate(2), 0, math.pi * 1.5, false, paint);
  }

  @override
  bool shouldRepaint(covariant _ArcPainter oldDelegate) =>
      oldDelegate.opacity != opacity;
}

/// Замкнутое градиентное кольцо по ободку круга (состояние «подключено»).
class _RingPainter extends CustomPainter {
  _RingPainter({required this.opacity});
  final double opacity;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3
      ..shader = SweepGradient(
        colors: [
          kBrandBlue.withValues(alpha: opacity),
          kBrandCyan.withValues(alpha: opacity),
          kBrandBlue.withValues(alpha: opacity),
        ],
      ).createShader(rect);
    canvas.drawOval(rect.deflate(1.5), paint);
  }

  @override
  bool shouldRepaint(covariant _RingPainter oldDelegate) =>
      oldDelegate.opacity != opacity;
}

/// Расходящиеся от ободка круга волны («радар»). Три волны со сдвигом фазы:
/// каждая рождается на радиусе круга, расширяется и тает.
class _PulseWavesPainter extends CustomPainter {
  _PulseWavesPainter({
    required this.progress,
    required this.baseRadius,
    required this.color,
  });

  final double progress; // 0..1, цикл
  final double baseRadius;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    const waves = 3;
    for (var k = 0; k < waves; k++) {
      final t = (progress + k / waves) % 1.0;
      final eased = Curves.easeOut.transform(t);
      final radius = baseRadius * (1.0 + 0.30 * eased);
      final alpha = (1 - t) * 0.28;
      if (alpha <= 0.01) continue;
      final paint = Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = 2.0 - t
        ..color = color.withValues(alpha: alpha);
      canvas.drawCircle(center, radius, paint);
    }
  }

  @override
  bool shouldRepaint(covariant _PulseWavesPainter oldDelegate) =>
      oldDelegate.progress != progress || oldDelegate.color != color;
}
