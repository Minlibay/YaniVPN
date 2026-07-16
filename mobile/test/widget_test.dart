import 'package:flutter_test/flutter_test.dart';
import 'package:yanivpn/widgets/usage_bar.dart';

void main() {
  test('formatBytes форматирует размеры', () {
    expect(formatBytes(0), '0 Б');
    expect(formatBytes(1024), '1.0 КБ');
    expect(formatBytes(2147483648), '2.0 ГБ');
  });
}
