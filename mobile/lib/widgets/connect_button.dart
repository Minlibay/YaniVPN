import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme.dart';

/// Большая круглая кнопка подключения — центр главного экрана.
///
/// Состояния:
/// - отключено: тёмный круг с тонкой рамкой;
/// - подключение: вращающаяся градиентная дуга;
/// - подключено: заливка градиентом бренда + мягкое «дышащее» свечение.
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
    const size = 190.0;
    return Semantics(
      button: true,
      label: widget.connected ? 'Отключить VPN' : 'Подключить VPN',
      child: GestureDetector(
        onTap: widget.enabled ? widget.onTap : null,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, _) {
            // «Дыхание» свечения в подключённом состоянии.
            final breath = widget.connected
                ? 0.5 + 0.5 * math.sin(_controller.value * 2 * math.pi)
                : 0.0;
            return SizedBox(
              width: size + 56,
              height: size + 56,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  if (widget.connected)
                    Container(
                      width: size + 36 + breath * 14,
                      height: size + 36 + breath * 14,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: kBrandBlue.withValues(
                                alpha: 0.28 + breath * 0.12),
                            blurRadius: 60,
                            spreadRadius: 6,
                          ),
                          BoxShadow(
                            color: kBrandCyan.withValues(alpha: 0.14),
                            blurRadius: 90,
                            spreadRadius: 18,
                          ),
                        ],
                      ),
                    ),
                  if (widget.connecting)
                    SizedBox(
                      width: size + 24,
                      height: size + 24,
                      child: Transform.rotate(
                        angle: _controller.value * 2 * math.pi,
                        child: CustomPaint(painter: _ArcPainter()),
                      ),
                    )
                  else
                    Container(
                      width: size + 24,
                      height: size + 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: widget.connected
                              ? kBrandCyan.withValues(alpha: 0.5)
                              : kBorder,
                          width: 1.5,
                        ),
                      ),
                    ),
                  AnimatedContainer(
                    duration: const Duration(milliseconds: 350),
                    curve: Curves.easeOut,
                    width: size,
                    height: size,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      gradient: widget.connected ? kBrandGradient : null,
                      color: widget.connected ? null : kSurfaceRaised,
                      border: widget.connected
                          ? null
                          : Border.all(color: kBorder, width: 1.5),
                    ),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(
                          Icons.power_settings_new_rounded,
                          size: 56,
                          color: widget.connected
                              ? Colors.white
                              : (widget.enabled ? kBrandBlue : kTextDim),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          widget.connecting
                              ? 'СОЕДИНЕНИЕ'
                              : (widget.connected ? 'ЗАЩИЩЕНО' : 'ВКЛЮЧИТЬ'),
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 2.5,
                            color: widget.connected
                                ? Colors.white.withValues(alpha: 0.9)
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
      ..strokeWidth = 3
      ..strokeCap = StrokeCap.round
      ..shader = const SweepGradient(
        colors: [Colors.transparent, kBrandBlue, kBrandCyan],
        stops: [0.25, 0.6, 1],
      ).createShader(rect);
    canvas.drawArc(rect.deflate(1.5), 0, math.pi * 1.5, false, paint);
  }

  @override
  bool shouldRepaint(covariant _ArcPainter oldDelegate) => false;
}
