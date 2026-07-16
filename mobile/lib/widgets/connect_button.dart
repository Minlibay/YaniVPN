import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

/// Кнопка подключения, встроенная в арт маскота.
///
/// Показывается исходная картинка целиком (кот на тёмном круге), а поверх
/// её круга рисуются живые элементы: иконка и подпись состояния, вращающаяся
/// градиентная дуга при подключении, градиентное кольцо и «дышащее» свечение
/// в подключённом состоянии. Тап по картинке включает/выключает VPN.
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
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 2),
  );

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
      if (!_controller.isAnimating) _controller.repeat();
    } else {
      _controller.stop();
      _controller.value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
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
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            final breath = widget.connected
                ? 0.5 + 0.5 * math.sin(_controller.value * 2 * math.pi)
                : 0.0;
            return SizedBox(
              width: width,
              height: _artH * s,
              child: Stack(
                clipBehavior: Clip.none,
                children: [
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
                          angle: _controller.value * 2 * math.pi,
                          child: CustomPaint(painter: _ArcPainter()),
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
                        Icon(
                          Icons.power_settings_new_rounded,
                          size: 52,
                          color: widget.connected
                              ? kBrandCyan
                              : (widget.enabled ? kBrandBlue : kTextDim),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          widget.connecting
                              ? 'СОЕДИНЕНИЕ'
                              : (widget.connected ? 'ЗАЩИЩЕНО' : 'ВКЛЮЧИТЬ'),
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
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

/// Градиентная дуга (3/4 круга) для состояния «подключение».
class _ArcPainter extends CustomPainter {
  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 3.5
      ..strokeCap = StrokeCap.round
      ..shader = const SweepGradient(
        colors: [Colors.transparent, kBrandBlue, kBrandCyan],
        stops: [0.25, 0.6, 1],
      ).createShader(rect);
    canvas.drawArc(rect.deflate(2), 0, math.pi * 1.5, false, paint);
  }

  @override
  bool shouldRepaint(covariant _ArcPainter oldDelegate) => false;
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
