import 'package:flutter/material.dart';

import '../theme.dart';

/// Фирменная надпись «YaniVPN»: «Yani» белым, «VPN» — градиентом бренда.
/// Тот же приём, что и в шапке веб-панели.
class BrandWordmark extends StatelessWidget {
  const BrandWordmark({super.key, this.fontSize = 24});
  final double fontSize;

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(
      fontSize: fontSize,
      fontWeight: FontWeight.w800,
      letterSpacing: -0.5,
      height: 1,
    );
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text('Yani', style: style.copyWith(color: Colors.white)),
        ShaderMask(
          shaderCallback: (rect) => kBrandGradient.createShader(rect),
          child: Text('VPN', style: style.copyWith(color: Colors.white)),
        ),
      ],
    );
  }
}
